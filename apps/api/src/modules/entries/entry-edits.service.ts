import { Injectable } from '@nestjs/common'
import {
	distributeOptionValues,
	type EntryChange,
	type EntryValues,
	type FoodEntryResponse,
	getCorrectedValues,
	type LoggableMealType,
	type OptionValues,
} from '@kus/shared'

import type { FoodEntry, Prisma } from '../../generated/prisma/client'
import { EntryChangedException, EntryNotFoundException } from './entries.exceptions'
import { roundNutrition, toFoodEntryResponse } from './entries.mapper'
import { EntriesRepository, type EntryWithMeal } from './entries.repository'

type CorrectionFields = Record<string, string | number | boolean | null>

const toEntryValues = (entry: FoodEntry): EntryValues => ({
	grams: entry.grams,
	kcal: entry.kcal,
	protein: entry.proteinG,
	fat: entry.fatG,
	carbs: entry.carbsG,
	fiber: entry.fiberG,
})

const toCorrectionFields = (entry: FoodEntry): CorrectionFields => ({
	name: entry.name,
	category: entry.category,
	quantity: entry.quantity,
	...toEntryValues(entry),
})

/** Only the fields that changed, as a Correction stores them; null if nothing did. */
const getChangedFields = (
	before: CorrectionFields,
	after: CorrectionFields,
): { before: CorrectionFields; after: CorrectionFields } | null => {
	const keys = Object.keys(after).filter((key) => before[key] !== after[key])
	if (keys.length === 0) return null
	return {
		before: Object.fromEntries(keys.map((key) => [key, before[key] ?? null])),
		after: Object.fromEntries(keys.map((key) => [key, after[key] ?? null])),
	}
}

const toValueColumns = (values: EntryValues) => ({
	grams: values.grams,
	kcal: values.kcal,
	proteinG: values.protein,
	fatG: values.fat,
	carbsG: values.carbs,
	fiberG: values.fiber,
})

/** Pieces follow a new weight ("3 яйця" 150 → 200 г = 4); unchanged weight keeps the count. */
const getQuantity = (entry: FoodEntry, grams: number): number | null => {
	if (entry.quantity === null || grams === entry.grams) return entry.quantity
	return roundNutrition((entry.quantity * grams) / entry.grams)
}

const getSourceMessageIds = (entries: FoodEntry[]): string[] => [
	...new Set(entries.flatMap((entry) => entry.sourceMessageId ?? [])),
]

/** What changes in an entry; the chat's ref is already resolved to the id. */
export type EntryValuesChange = Omit<EntryChange, 'ref'>

/**
 * New numbers for the same food are the user's (MANUAL); for a different food («не борщ, а суп») the
 * model estimated them. Either way they are no longer a label's or a saved food's.
 */
const getValuesSource = (change: EntryValuesChange): 'MANUAL' | 'ESTIMATE' =>
	change.name === null ? 'MANUAL' : 'ESTIMATE'

export interface EntryCorrection {
	id: string
	change: EntryValuesChange
}

export interface ManualEntryEdit {
	userId: string
	id: string
	/** A new weight of the whole portion; undefined keeps it. */
	grams: number | undefined
	/** Another meal of the same day; undefined keeps it. */
	mealType: LoggableMealType | undefined
	/** When a meal created by the move was eaten. */
	getEatenAt: (meal: { type: LoggableMealType; localDate: Date }) => Date
}

export interface ManualEntryEditResult {
	entry: FoodEntryResponse
	isWeightChanged: boolean
	isMealChanged: boolean
}

/**
 * Changes of logged entries — by the chat (correct / delete / restore) or a clarify answer. Each
 * keeps a Correction with the fields before and after. Returns the source messages of the entries
 * it changed, so the chat can refresh their cards.
 */
@Injectable()
export class EntryEditsService {
	constructor(private readonly entriesRepository: EntriesRepository) {}

	async correctEntries(
		{ userId, corrections }: { userId: string; corrections: EntryCorrection[] },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		if (corrections.length === 0) return []
		const entries = await this.findActive(
			userId,
			corrections.map(({ id }) => id),
			tx,
		)
		const byId = new Map(entries.map((entry) => [entry.id, entry]))
		const changes = []
		for (const { id, change } of corrections) {
			const entry = byId.get(id)
			if (!entry) throw new EntryChangedException()
			const values = getCorrectedValues(toEntryValues(entry), change)
			const after = {
				...toCorrectionFields(entry),
				...values,
				name: change.name ?? entry.name,
				category: change.category ?? entry.category,
				quantity: getQuantity(entry, values.grams),
			}
			const changed = getChangedFields(toCorrectionFields(entry), after)
			if (!changed) continue
			const isUpdated = await this.entriesRepository.updateEntry(
				{
					userId,
					id,
					data: {
						...toValueColumns(values),
						name: after.name,
						category: after.category,
						quantity: after.quantity,
						isEdited: true,
						...(change.values ? { source: getValuesSource(change), myFoodId: null } : {}),
					},
				},
				tx,
			)
			// deleted by a parallel request after the read: no Correction for a change that didn't happen
			if (!isUpdated) throw new EntryChangedException()
			changes.push({ userId, foodEntryId: id, ...changed })
		}
		await this.entriesRepository.createCorrections(changes, tx)
		return getSourceMessageIds(entries)
	}

	findActiveEntry(
		{ userId, id }: { userId: string; id: string },
		tx: Prisma.TransactionClient,
	): Promise<EntryWithMeal | null> {
		return this.entriesRepository.findActiveEntryWithMeal({ userId, id }, tx)
	}

	/**
	 * The edit sheet: a new weight rescales the entry by its density (the same correction as
	 * «зміни порцію на 150 г» in the chat); another meal moves it within the day, creating the
	 * meal when the day has none of that type — the one it leaves empty simply stops showing.
	 * Read-then-write without a row lock, like the chat's edits: two sheets saving the same entry
	 * at once is not a case a single-user tracker guards against.
	 */
	async editEntry(
		{ userId, id, grams, mealType, getEatenAt }: ManualEntryEdit,
		tx: Prisma.TransactionClient,
	): Promise<ManualEntryEditResult> {
		const entry = await this.entriesRepository.findActiveEntryWithMeal({ userId, id }, tx)
		if (!entry) throw new EntryNotFoundException()
		const isWeightChanged = grams !== undefined && grams !== entry.grams
		const isMealChanged = mealType !== undefined && mealType !== entry.meal.type
		if (!isWeightChanged && !isMealChanged) {
			return { entry: toFoodEntryResponse(entry), isWeightChanged, isMealChanged }
		}
		if (isWeightChanged) {
			await this.correctEntries(
				{
					userId,
					corrections: [{ id, change: { grams, values: null, name: null, category: null } }],
				},
				tx,
			)
		}
		if (isMealChanged) await this.moveEntry(entry, mealType, getEatenAt, tx)
		const updated = await this.entriesRepository.findActiveEntryWithMeal({ userId, id }, tx)
		// written a moment ago inside this same transaction
		if (!updated) throw new EntryChangedException()
		return { entry: toFoodEntryResponse(updated), isWeightChanged, isMealChanged }
	}

	deleteEntries(
		{ userId, ids }: { userId: string; ids: string[] },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.setDeleted({ userId, ids, isDeleted: true }, tx)
	}

	restoreEntries(
		{ userId, ids }: { userId: string; ids: string[] },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		return this.setDeleted({ userId, ids, isDeleted: false }, tx)
	}

	/**
	 * Re-logs entries with the values of a clarify answer (a tapped option or values in words), and
	 * renames a single entry if the option says so. `false` = the entries are gone or would break limits.
	 */
	async applyOptionValues(
		{
			userId,
			entryIds,
			values,
			name,
		}: { userId: string; entryIds: string[]; values: OptionValues; name: string | null },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const entries = await this.entriesRepository.findActiveEntries({ userId, ids: entryIds }, tx)
		// the answer's totals cover every entry it asked about: one deleted, the rest can't take it all
		if (entries.length !== entryIds.length) return false
		const updated = distributeOptionValues(entries.map(toEntryValues), values)
		if (!updated) return false
		const rename = entries.length === 1 ? name : null

		const changes = []
		for (const [index, entry] of entries.entries()) {
			const after = updated[index]
			if (!after) continue
			const fields = {
				...toCorrectionFields(entry),
				...after,
				name: rename ?? entry.name,
				quantity: getQuantity(entry, after.grams),
			}
			const changed = getChangedFields(toCorrectionFields(entry), fields)
			if (!changed) continue
			const isUpdated = await this.entriesRepository.updateEntry(
				{
					userId,
					id: entry.id,
					data: { ...toValueColumns(after), name: fields.name, quantity: fields.quantity },
				},
				tx,
			)
			if (!isUpdated) return false
			changes.push({ userId, foodEntryId: entry.id, ...changed })
		}
		await this.entriesRepository.createCorrections(changes, tx)
		return true
	}

	private async moveEntry(
		entry: EntryWithMeal,
		mealType: LoggableMealType,
		getEatenAt: ManualEntryEdit['getEatenAt'],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const { userId, id } = entry
		const { localDate } = entry.meal
		const meal = await this.entriesRepository.findOrCreateMeal(
			{
				userId,
				type: mealType,
				localDate,
				eatenAt: getEatenAt({ type: mealType, localDate }),
				sourceMessageId: null,
			},
			tx,
		)
		const isMoved = await this.entriesRepository.moveEntryToMeal(
			{ userId, id, mealId: meal.id },
			tx,
		)
		// deleted by a parallel request after the read
		if (!isMoved) throw new EntryChangedException()
		await this.entriesRepository.createCorrections(
			[{ userId, foodEntryId: id, before: { mealType: entry.meal.type }, after: { mealType } }],
			tx,
		)
	}

	private async findActive(
		userId: string,
		ids: string[],
		tx: Prisma.TransactionClient,
	): Promise<FoodEntry[]> {
		const entries = await this.entriesRepository.findActiveEntries({ userId, ids }, tx)
		if (entries.length !== new Set(ids).size) throw new EntryChangedException()
		return entries
	}

	private async setDeleted(
		{ userId, ids, isDeleted }: { userId: string; ids: string[]; isDeleted: boolean },
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		if (ids.length === 0) return []
		const entries = isDeleted
			? await this.findActive(userId, ids, tx)
			: await this.entriesRepository.findDeletedEntries({ userId, ids }, tx)
		if (entries.length !== ids.length) throw new EntryChangedException()
		const count = await this.entriesRepository.setDeletedAt(
			{ userId, ids, deletedAt: isDeleted ? new Date() : null },
			tx,
		)
		// a parallel request flipped one of them between the read and the write
		if (count !== ids.length) throw new EntryChangedException()
		await this.entriesRepository.createCorrections(
			ids.map((foodEntryId) => ({
				userId,
				foodEntryId,
				before: { deleted: !isDeleted },
				after: { deleted: isDeleted },
			})),
			tx,
		)
		return getSourceMessageIds(entries)
	}
}
