import { describe, expect, it } from 'vitest'

import { formatContext, type FoodParseContext } from './context.js'
import type { TodayEntryContext } from './edit-context.js'
import { messageIntentSchema } from '../schemas/message-intent.js'
import { sendMessageRequestSchema } from '../schemas/messages.js'

const entry: TodayEntryContext = {
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
}

const makeContext = (overrides: Partial<FoodParseContext> = {}): FoodParseContext => ({
	localTime: '2026-11-19 13:20, Thursday',
	dayTotals: { kcal: 120, protein: 8, fat: 4, carbs: 12 },
	meals: [],
	entries: [entry],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-11-19', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
	...overrides,
})

describe('formatContext pot marker', () => {
	it('marks a pot without a saved recipe', () => {
		const text = formatContext(makeContext({ entries: [{ ...entry, pot: 'unsaved' }] }))

		expect(text).toContain('C 12 (pot, recipe not saved)')
	})

	it('marks a pot with a saved recipe, before the changed marker', () => {
		const text = formatContext(
			makeContext({ entries: [{ ...entry, pot: 'saved', isEdited: true }] }),
		)

		expect(text).toContain('C 12 (pot, recipe saved) (changed after logging)')
	})

	it('says nothing about a plain entry', () => {
		expect(formatContext(makeContext())).not.toContain('(pot')
	})
})

describe('formatContext intent', () => {
	it('tells the model the message comes from «Новий рецепт»', () => {
		const text = formatContext(makeContext({ intent: 'new_recipe' }))

		expect(text).toContain('This message comes from «Новий рецепт».')
	})

	it.each([[undefined], [null]])('adds no line for intent %s', (intent) => {
		expect(formatContext(makeContext({ intent }))).not.toContain('This message comes from')
	})
})

describe('message intent in the request', () => {
	const request = { clientMessageId: '0198f3a0-0000-7000-8000-000000000001', text: 'борщ' }

	it('accepts new_recipe, null and no intent', () => {
		expect(sendMessageRequestSchema.safeParse({ ...request, intent: 'new_recipe' }).success).toBe(
			true,
		)
		expect(sendMessageRequestSchema.safeParse({ ...request, intent: null }).success).toBe(true)
		expect(sendMessageRequestSchema.safeParse(request).success).toBe(true)
	})

	it('rejects an unknown intent', () => {
		expect(messageIntentSchema.safeParse('delete_all').success).toBe(false)
		expect(sendMessageRequestSchema.safeParse({ ...request, intent: 'x' }).success).toBe(false)
	})
})
