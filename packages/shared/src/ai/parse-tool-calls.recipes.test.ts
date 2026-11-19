import { describe, expect, it } from 'vitest'

import type { TodayEntryContext } from './edit-context.js'
import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'

const pot: TodayEntryContext = {
	ref: 'e1',
	name: 'Суп курячий',
	mealType: 'LUNCH',
	grams: 350,
	kcal: 120,
	protein: 8,
	fat: 4,
	carbs: 12,
	fiber: null,
	category: 'soup',
	source: 'ESTIMATE',
	isEdited: false,
	pot: 'unsaved',
}

const refs: ParseRefs = {
	memoryRefs: new Set(['m1']),
	copyRefs: new Set(['e1']),
	recipeRefs: new Set(['r1']),
	entries: new Map([[pot.ref, pot]]),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-11-18',
	measurementDays: new Set(),
}

const ingredient = {
	name: 'Куряче філе',
	grams: 400,
	kcal: 440,
	protein: 90,
	fat: 6,
	carbs: 0,
	fiber: null,
}

const recipe = { ingredients: [ingredient], waterMl: 3000, cookedGrams: null, servings: null }

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const item = (extra: Record<string, unknown> = {}) => ({
	name: 'Суп курячий',
	grams: 350,
	quantity: null,
	kcal: 120,
	protein: 8,
	fat: 4,
	carbs: 12,
	fiber: null,
	category: 'soup',
	source: 'ESTIMATE',
	confidence: 0.4,
	assumption: null,
	memoryRef: null,
	recipe: null,
	recipeRef: null,
	...extra,
})

const logFood = (extra: Record<string, unknown> = {}): RawToolCall =>
	call('log_food', { items: [item(extra)], mealType: null, reply: 'Записав!' })

const saveRecipe = (extra: Record<string, unknown> = {}): RawToolCall =>
	call('save_recipe', {
		name: 'Суп курячий',
		aliases: [],
		category: 'soup',
		entryRef: null,
		recipe: null,
		portionGrams: null,
		...extra,
	})

const reply = call('reply', { text: 'Збережено' })

const errorsOf = (calls: RawToolCall[]): string => {
	const result = parseToolCalls(calls, refs)
	return result.ok ? '' : result.errors.join(' | ')
}

describe('log_food recipe', () => {
	it('accepts a pot and skips the macros check (the backend counts the portion)', () => {
		const result = parseToolCalls([logFood({ recipe, protein: 0, fat: 0, carbs: 0 })], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'log') return
		expect(result.decision.log.items[0]?.recipe?.waterMl).toBe(3000)
	})

	it('still checks the macros of a plain item', () => {
		expect(errorsOf([logFood({ protein: 0, fat: 0, carbs: 0 })])).toContain('kcal does not match')
	})

	it.each([
		['memoryRef', { memoryRef: 'm1', source: 'MEMORY' }],
		['copyRef', { copyRef: 'e1' }],
		['recipeRef', { recipeRef: 'r1' }],
	])('rejects recipe together with %s', (_label, extra) => {
		expect(errorsOf([logFood({ recipe, ...extra })])).toContain('recipe together with')
	})

	it('rejects a soup without water, cooked weight or servings, with a hint', () => {
		const message = errorsOf([logFood({ recipe: { ...recipe, waterMl: null } })])
		expect(message).toContain('a soup needs waterMl, cookedGrams or servings')
	})

	it.each([
		['cookedGrams', { cookedGrams: 3200 }],
		['servings', { servings: 6 }],
	])('accepts a soup with %s instead of water', (_label, extra) => {
		const body = { ...recipe, waterMl: null, ...extra }
		expect(parseToolCalls([logFood({ recipe: body })], refs).ok).toBe(true)
	})

	it('does not ask water of a dish that is not a soup', () => {
		const body = { ...recipe, waterMl: null }
		expect(parseToolCalls([logFood({ recipe: body, category: 'plate' })], refs).ok).toBe(true)
	})

	it('rejects a pot denser than 9.5 kcal per gram', () => {
		const body = { ...recipe, waterMl: null, cookedGrams: 40 }
		expect(errorsOf([logFood({ recipe: body })])).toContain('denser than 9.5')
	})

	it('rejects a broken ingredient', () => {
		const body = { ...recipe, ingredients: [{ ...ingredient, grams: 6000 }] }
		expect(errorsOf([logFood({ recipe: body })])).toContain('items.0.recipe.ingredients.0.grams')
	})

	it('rejects a pot without ingredients', () => {
		expect(errorsOf([logFood({ recipe: { ...recipe, ingredients: [] } })])).toContain(
			'recipe.ingredients',
		)
	})
})

describe('log_food recipeRef', () => {
	it('accepts a ref of the saved recipes and skips the macros check', () => {
		const result = parseToolCalls(
			[logFood({ recipeRef: 'r1', protein: 0, fat: 0, carbs: 0 })],
			refs,
		)
		expect(result.ok).toBe(true)
	})

	it('rejects a ref that is not in the context', () => {
		expect(errorsOf([logFood({ recipeRef: 'r9' })])).toContain('recipeRef "r9" is not in')
	})

	it.each([
		['memoryRef', { memoryRef: 'm1', source: 'MEMORY' }],
		['copyRef', { copyRef: 'e1' }],
	])('rejects recipeRef together with %s', (_label, extra) => {
		expect(errorsOf([logFood({ recipeRef: 'r1', ...extra })])).toContain(
			'recipeRef together with memoryRef or copyRef',
		)
	})

	it('rejects a malformed ref', () => {
		expect(errorsOf([logFood({ recipeRef: 'x1' })])).toContain('recipeRef')
	})
})

describe('save_recipe', () => {
	it('accepts entryRef of a pot logged today', () => {
		const result = parseToolCalls([saveRecipe({ entryRef: 'e1' }), reply], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'reply') return
		expect(result.decision.memory.recipes).toHaveLength(1)
	})

	it('accepts recipe with portionGrams', () => {
		expect(parseToolCalls([saveRecipe({ recipe, portionGrams: 350 }), reply], refs).ok).toBe(true)
	})

	it('accepts recipe with cookedGrams and servings instead of portionGrams', () => {
		const body = { ...recipe, cookedGrams: 3200, servings: 8 }
		expect(parseToolCalls([saveRecipe({ recipe: body }), reply], refs).ok).toBe(true)
	})

	it('goes next to log_food as well', () => {
		const result = parseToolCalls([logFood({ recipe }), saveRecipe({ entryRef: 'e1' })], refs)
		expect(result.ok).toBe(true)
	})

	it('rejects both entryRef and recipe', () => {
		expect(errorsOf([saveRecipe({ entryRef: 'e1', recipe, portionGrams: 350 }), reply])).toContain(
			'exactly one of entryRef or recipe',
		)
	})

	it('rejects neither entryRef nor recipe', () => {
		expect(errorsOf([saveRecipe(), reply])).toContain('exactly one of entryRef or recipe')
	})

	it('rejects a recipe without portionGrams and without cookedGrams with servings', () => {
		const message = errorsOf([saveRecipe({ recipe: { ...recipe, servings: 6 } }), reply])
		expect(message).toContain('needs portionGrams, or cookedGrams with servings')
	})

	it("rejects an entryRef that is not in today's entries", () => {
		expect(errorsOf([saveRecipe({ entryRef: 'e7' }), reply])).toContain('"e7" is not in')
	})

	it('rejects an entryRef of an entry that is not a pot, with a hint', () => {
		const plain: TodayEntryContext = { ...pot, ref: 'e2', pot: undefined }
		const plainRefs: ParseRefs = { ...refs, entries: new Map([[plain.ref, plain]]) }
		const result = parseToolCalls([saveRecipe({ entryRef: 'e2' }), reply], plainRefs)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors.join(' | ')).toContain('"e2" is not a pot')
	})

	it('accepts the entryRef of a pot whose recipe is saved (the new one replaces it)', () => {
		const saved: TodayEntryContext = { ...pot, pot: 'saved' }
		const savedRefs: ParseRefs = { ...refs, entries: new Map([[saved.ref, saved]]) }
		expect(parseToolCalls([saveRecipe({ entryRef: 'e1' }), reply], savedRefs).ok).toBe(true)
	})

	it('rejects a malformed entryRef', () => {
		expect(errorsOf([saveRecipe({ entryRef: 'm1' }), reply])).toContain('entryRef')
	})

	it('rejects two recipes in one message', () => {
		expect(
			errorsOf([saveRecipe({ entryRef: 'e1' }), saveRecipe({ entryRef: 'e1' }), reply]),
		).toContain('at most 1 per message')
	})

	it('needs a reply or log_food next to it', () => {
		expect(parseToolCalls([saveRecipe({ entryRef: 'e1' })], refs).ok).toBe(false)
	})
})

describe('correct_entry recipe', () => {
	const correct = (change: Record<string, unknown>): RawToolCall =>
		call('correct_entry', { changes: [{ ref: 'e1', ...change }] })

	it('takes the water of the pot', () => {
		const result = parseToolCalls([correct({ recipe: { waterMl: 4000 } }), reply], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'edit') return
		expect(result.decision.edits.corrections[0]?.recipe).toEqual({
			waterMl: 4000,
			cookedGrams: null,
		})
	})

	it('takes the cooked weight of the pot', () => {
		expect(parseToolCalls([correct({ recipe: { cookedGrams: 3000 } }), reply], refs).ok).toBe(true)
	})

	it('rejects the pot correction of an entry that is not a pot', () => {
		const plain: TodayEntryContext = { ...pot, pot: undefined }
		const plainRefs: ParseRefs = { ...refs, entries: new Map([[plain.ref, plain]]) }
		const result = parseToolCalls([correct({ recipe: { waterMl: 4000 } }), reply], plainRefs)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.errors.join(' | ')).toContain('e1 is not a pot')
	})

	it('rejects an empty recipe', () => {
		expect(errorsOf([correct({ recipe: {} }), reply])).toContain(
			'recipe needs waterMl or cookedGrams',
		)
	})

	it.each([
		['grams', { grams: 200 }],
		['values', { values: { kcal: 100, protein: 5, fat: 3, carbs: 12, fiber: null } }],
	])('rejects recipe together with %s', (_label, extra) => {
		expect(errorsOf([correct({ recipe: { waterMl: 4000 }, ...extra }), reply])).toContain(
			'recipe is not combined with grams or values',
		)
	})

	it('rejects water out of range', () => {
		expect(errorsOf([correct({ recipe: { waterMl: -1 } }), reply])).toContain('recipe.waterMl')
	})
})
