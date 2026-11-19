import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RecipePortionInvalidException } from '../recipes/recipes.exceptions'
import {
	createService,
	getLogged,
	NOW,
	toItem,
	toLogDecision,
} from './chat-turn.service.test-utils'

beforeEach(() => {
	vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
	vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
})

const POT_BODY = {
	ingredients: [
		{ name: 'Філе', grams: 410, kcal: 450, protein: 90, fat: 6, carbs: 0, fiber: null },
		{ name: 'Картопля', grams: 500, kcal: 440, protein: 10, fat: 1, carbs: 100, fiber: null },
	],
	waterMl: 3000,
	cookedGrams: null,
	servings: null,
}

const SAVED_RECIPE = {
	id: 'recipe-1',
	name: 'Борщ',
	cookedGrams: 1000,
	defaultGrams: 350,
	category: 'borscht',
	ingredients: [
		{ grams: 500, kcal: 600, proteinG: 20, fatG: 10, carbsG: 100 },
		{ grams: 500, kcal: 400, proteinG: 60, fatG: 20, carbsG: 0 },
	],
}

/** 500 g of the pot above: 114 kcal. */
const POT_ENTRY = {
	id: 'entry-e1',
	name: 'Суп',
	grams: 500,
	kcal: 114,
	proteinG: 10,
	fatG: 1,
	carbsG: 10,
	fiberG: null,
	category: 'soup',
	source: 'ESTIMATE',
	confidence: 0.4,
	myFoodId: null,
	recipeId: null,
	potId: 'pot-1',
	recipeDraft: POT_BODY,
	meal: { type: 'LUNCH', localDate: new Date('2026-10-18T00:00:00Z') },
}

const COPY_REFS = new Map([['e1', 'entry-e1']])

describe('ChatTurnService.saveDecision pot items (recipe)', () => {
	it('counts the portion from the composition, never from the model, and starts a pot', async () => {
		const { save, logEntries } = createService()

		await save(
			toLogDecision([
				toItem('Суп курячий', {
					grams: 850,
					kcal: 999,
					protein: 99,
					category: 'soup',
					confidence: 0.55,
					source: 'REFERENCE',
					recipe: POT_BODY,
					recipeRef: null,
				}),
			]),
		)

		const entry = getLogged(logEntries).entries[0]?.entry
		expect(entry).toMatchObject({
			name: 'Суп курячий',
			grams: 850,
			source: 'ESTIMATE',
			confidence: 0.55,
			recipeId: null,
			myFoodId: null,
			recipeDraft: POT_BODY,
		})
		expect(entry?.kcal).toBeCloseTo(193.5, 0)
		expect(entry?.potId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/))
		expect(entry).not.toHaveProperty('recipe')
		expect(entry).not.toHaveProperty('recipeRef')
	})

	it('gives each pot its own pot id', async () => {
		const { save, logEntries } = createService()

		await save(
			toLogDecision([
				toItem('Суп', { grams: 300, category: 'soup', recipe: POT_BODY, recipeRef: null }),
				toItem('Борщ', { grams: 300, category: 'soup', recipe: POT_BODY, recipeRef: null }),
			]),
		)

		const [first, second] = getLogged(logEntries).entries.map(({ entry }) => entry.potId)
		expect(first).not.toBe(second)
	})

	it('rejects a portion denser than 9.5 kcal/g and logs nothing', async () => {
		const { save, logEntries } = createService()

		await expect(
			save(
				toLogDecision([
					toItem('Суп', { grams: 100, recipe: { ...POT_BODY, cookedGrams: 50 }, recipeRef: null }),
				]),
			),
		).rejects.toBeInstanceOf(RecipePortionInvalidException)
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('rejects a portion over 5000 g', async () => {
		const { save, logEntries } = createService()

		await expect(
			save(
				toLogDecision([
					toItem('Суп', {
						grams: 5001,
						recipe: { ...POT_BODY, waterMl: 20000 },
						recipeRef: null,
					}),
				]),
			),
		).rejects.toBeInstanceOf(RecipePortionInvalidException)
		expect(logEntries).not.toHaveBeenCalled()
	})
})

describe('ChatTurnService.saveDecision saved recipe items (recipeRef)', () => {
	const run = (items: ReturnType<typeof toItem>[], byRef: Map<string, unknown> | undefined) => {
		const service = createService()
		const done = service.save(
			toLogDecision(items),
			undefined,
			undefined,
			undefined,
			undefined,
			byRef,
		)
		return { ...service, done }
	}

	it('takes the values of the saved recipe through the turn map and counts one use', async () => {
		const { done, logEntries, markUsed } = run(
			[
				toItem('Борщ', { grams: 350, kcal: 999, recipe: null, recipeRef: 'r1' }),
				toItem('Борщ', { grams: 175, recipe: null, recipeRef: 'r1' }),
			],
			new Map([['r1', SAVED_RECIPE]]),
		)
		await done

		const [first, second] = getLogged(logEntries).entries.map(({ entry }) => entry)
		expect(first).toMatchObject({ kcal: 350, protein: 28, recipeId: 'recipe-1', source: 'MEMORY' })
		expect(first?.potId).toBeNull()
		expect(second?.kcal).toBe(175)
		expect(markUsed).toHaveBeenCalledWith(
			{ userId: 'u1', ids: ['recipe-1'], usedAt: NOW },
			expect.anything(),
		)
	})

	it('rejects a recipeRef outside the map of the turn instead of swallowing it', async () => {
		const { done, logEntries } = run([toItem('Борщ', { recipe: null, recipeRef: 'r1' })], undefined)

		await expect(done).rejects.toThrow('recipeRef is not mapped')
		expect(logEntries).not.toHaveBeenCalled()
	})

	it('rejects a portion over 5000 g', async () => {
		const { done, logEntries } = run(
			[toItem('Борщ', { grams: 5001, recipe: null, recipeRef: 'r1' })],
			new Map([['r1', SAVED_RECIPE]]),
		)

		await expect(done).rejects.toBeInstanceOf(RecipePortionInvalidException)
		expect(logEntries).not.toHaveBeenCalled()
	})
})

describe('ChatTurnService.saveDecision copy of a pot portion', () => {
	it('«ще тарілку»: the same pot with its draft, at the same density', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([POT_ENTRY])

		await save(toLogDecision([toItem('Суп', { copyRef: 'e1', grams: 250 })]), COPY_REFS)

		expect(getLogged(logEntries).entries[0]?.entry).toMatchObject({
			grams: 250,
			kcal: 57,
			potId: 'pot-1',
			recipeDraft: POT_BODY,
			recipeId: null,
		})
	})

	it('keeps the recipe link too when the recipe of the pot is saved, and counts no use', async () => {
		const { save, logEntries, findActiveEntriesByIds, markUsed } = createService()
		findActiveEntriesByIds.mockResolvedValue([{ ...POT_ENTRY, recipeId: 'recipe-1' }])

		await save(toLogDecision([toItem('Суп', { copyRef: 'e1', grams: 250 })]), COPY_REFS)

		expect(getLogged(logEntries).entries[0]?.entry).toMatchObject({
			potId: 'pot-1',
			recipeId: 'recipe-1',
		})
		expect(markUsed).toHaveBeenCalledWith(expect.objectContaining({ ids: [] }), expect.anything())
	})

	it('copies a portion with a broken draft as a plain entry, without a pot', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([{ ...POT_ENTRY, recipeDraft: { waterMl: 3000 } }])

		await save(toLogDecision([toItem('Суп', { copyRef: 'e1', grams: 250 })]), COPY_REFS)

		const entry = getLogged(logEntries).entries[0]?.entry
		expect(entry).toMatchObject({ kcal: 57 })
		expect(entry).not.toHaveProperty('potId')
		expect(entry).not.toHaveProperty('recipeDraft')
	})

	it('copies a plain entry without pot fields', async () => {
		const { save, logEntries, findActiveEntriesByIds } = createService()
		findActiveEntriesByIds.mockResolvedValue([
			{ ...POT_ENTRY, potId: null, recipeDraft: null, name: 'Хліб' },
		])

		await save(toLogDecision([toItem('Хліб', { copyRef: 'e1', grams: 250 })]), COPY_REFS)

		const entry = getLogged(logEntries).entries[0]?.entry
		expect(entry).not.toHaveProperty('potId')
		expect(entry).not.toHaveProperty('recipeDraft')
	})
})
