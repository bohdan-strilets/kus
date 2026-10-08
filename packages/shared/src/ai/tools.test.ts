import { describe, expect, it } from 'vitest'

import { FOOD_CATEGORIES } from '../schemas/enums.js'
import { buildFoodParseMessages, type FoodParseContext, selectHistory } from './context.js'
import { getAiFunctionTools } from './tools.js'

describe('getAiFunctionTools', () => {
	const tools = getAiFunctionTools()

	it('exposes the tools in a stable order', () => {
		expect(tools.map((tool) => tool.function.name)).toEqual([
			'log_food',
			'clarify',
			'correct_entry',
			'delete_entry',
			'restore_entry',
			'resolve_clarification',
			'not_food',
			'reply',
		])
	})

	it('builds plain JSON schema with the category enum and nullable fields required', () => {
		const logFood = tools.find((tool) => tool.function.name === 'log_food')
		const json = JSON.stringify(logFood?.function.parameters)
		expect(json).not.toContain('$schema')
		for (const category of FOOD_CATEGORIES) expect(json).toContain(`"${category}"`)
		expect(json).toContain('"required":["name","grams","quantity"')
	})
})

const context: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 420, protein: 20, fat: 15, carbs: 50 },
	meals: [{ type: 'BREAKFAST', kcal: 420 }],
	entries: [
		{
			ref: 'e1',
			name: 'Вівсянка',
			mealType: 'BREAKFAST',
			grams: 300,
			kcal: 420,
			protein: 20,
			fat: 15,
			carbs: 50,
			fiber: null,
			category: 'porridge',
			source: 'ESTIMATE',
		},
	],
	deletedEntries: [],
	openClarifications: [],
	goal: { dailyKcal: 2000, protein: 140, fat: 70, carbs: 200, remainingKcal: 1580 },
	memory: [],
	history: [],
}

describe('buildFoodParseMessages', () => {
	it('puts the cacheable prompt first and the user text last', () => {
		const messages = buildFoodParseMessages(context, '3 яйця')
		expect(messages[0]).toMatchObject({ role: 'system' })
		expect(JSON.stringify(messages[0])).toContain('"cache_control"')
		expect(JSON.stringify(messages[1])).toContain('Remaining today: 1580 kcal')
		expect(JSON.stringify(messages[1])).toContain('e1 BREAKFAST \\"Вівсянка\\"')
		expect(messages.at(-1)).toEqual({ role: 'user', content: '3 яйця' })
	})

	it('says when no goal is set', () => {
		const messages = buildFoodParseMessages({ ...context, goal: null }, 'привіт')
		expect(JSON.stringify(messages[1])).toContain('Goal: not set.')
	})
})

describe('selectHistory', () => {
	it('keeps the most recent turns within the budget, oldest first', () => {
		const turns = Array.from({ length: 10 }, (_, index) => ({
			role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
			content: `m${index}`,
		}))
		expect(selectHistory(turns).map((turn) => turn.content)).toEqual([
			'm4',
			'm5',
			'm6',
			'm7',
			'm8',
			'm9',
		])
	})

	it('cuts long messages and stops at the token budget', () => {
		const long = { role: 'user' as const, content: 'x'.repeat(5000) }
		const selected = selectHistory(Array.from({ length: 6 }, () => long))
		expect(selected[0]?.content).toHaveLength(500)
		// 1500 tokens ≈ 6000 chars → 12 cut messages would fit; 6 is the message cap
		expect(selected).toHaveLength(6)
	})
})
