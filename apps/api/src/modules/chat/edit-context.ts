import {
	clarifyOptionSchema,
	type DeletedEntryContext,
	MAX_CONTEXT_OPEN_CLARIFICATIONS,
	type OpenClarificationContext,
	type TodayEntryContext,
} from '@kus/shared'
import { z } from 'zod'

import type { EntryWithMealType } from '../entries/entries.repository'
import type { ClarificationWithEntries } from './clarifications.repository'

const storedOptionsSchema = z.array(clarifyOptionSchema)

/** Ref → database id of what the model saw in this request; nothing else can be changed. */
export interface EditRefIds {
	entries: ReadonlyMap<string, string>
	deletedEntries: ReadonlyMap<string, string>
	clarifications: ReadonlyMap<string, string>
}

export interface EditContext {
	entries: TodayEntryContext[]
	deletedEntries: DeletedEntryContext[]
	openClarifications: OpenClarificationContext[]
	refIds: EditRefIds
}

const toEntryContext = (entry: EntryWithMealType, ref: string): TodayEntryContext => ({
	ref,
	name: entry.name,
	mealType: entry.meal.type,
	grams: entry.grams,
	kcal: entry.kcal,
	protein: entry.proteinG,
	fat: entry.fatG,
	carbs: entry.carbsG,
	fiber: entry.fiberG,
	category: entry.category,
	source: entry.source,
})

/**
 * Numbers today's entries `e1…` (active oldest first, then the deleted ones) and the open questions
 * `c1…`. A question is shown only if all its entries are shown and its options carry values.
 */
export const buildEditContext = ({
	active,
	deleted,
	clarifications,
}: {
	active: EntryWithMealType[]
	deleted: EntryWithMealType[]
	clarifications: ClarificationWithEntries[]
}): EditContext => {
	const activeRefs = active.map((entry, index) => ({ entry, ref: `e${index + 1}` }))
	const deletedRefs = deleted.map((entry, index) => ({
		entry,
		ref: `e${active.length + index + 1}`,
	}))
	const refById = new Map(activeRefs.map(({ entry, ref }) => [entry.id, ref]))

	const openClarifications = clarifications
		.flatMap((clarification) => {
			const options = storedOptionsSchema.safeParse(clarification.options)
			const entryRefs = clarification.entries.map((link) => refById.get(link.foodEntryId))
			if (!options.success || entryRefs.some((ref) => ref === undefined)) return []
			return [
				{ clarification, options: options.data, entryRefs: entryRefs.flatMap((ref) => ref ?? []) },
			]
		})
		.slice(0, MAX_CONTEXT_OPEN_CLARIFICATIONS)
		.map(({ clarification, options, entryRefs }, index) => ({
			id: clarification.id,
			context: {
				ref: `c${index + 1}`,
				question: clarification.question,
				entryRefs,
				options,
			},
		}))

	return {
		entries: activeRefs.map(({ entry, ref }) => toEntryContext(entry, ref)),
		deletedEntries: deletedRefs.map(({ entry, ref }) => ({
			ref,
			name: entry.name,
			grams: entry.grams,
			kcal: entry.kcal,
		})),
		openClarifications: openClarifications.map(({ context }) => context),
		refIds: {
			entries: new Map(activeRefs.map(({ entry, ref }) => [ref, entry.id])),
			deletedEntries: new Map(deletedRefs.map(({ entry, ref }) => [ref, entry.id])),
			clarifications: new Map(openClarifications.map(({ id, context }) => [context.ref, id])),
		},
	}
}
