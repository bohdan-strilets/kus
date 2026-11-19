import type { AiCompletion } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { RECIPE_CASES, SAVED_BORSCHT } from './cases/recipe.cases.js'
import type { EvalCase } from './cases/index.js'
import { isCaseMemoryCorrect } from './memory-metrics.js'
import { isDecisionCorrect, isEditsCorrect } from './metrics.js'
import type { CompletionResponse } from './openrouter.js'
import { type RequestFn, runCase } from './run-case.js'

const OPTIONS = { apiKey: 'key', model: 'test/model', reasoning: 'low' as const }

type Call = { id: string; name: string; args: object }

const completion = (calls: Call[]): CompletionResponse => {
	const body: AiCompletion = {
		choices: [
			{
				message: {
					content: null,
					tool_calls: calls.map(({ id, name, args }) => ({
						id,
						function: { name, arguments: JSON.stringify(args) },
					})),
				},
				finish_reason: 'tool_calls',
			},
		],
		usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.01 },
	}
	return { completion: body, latencyMs: 5 }
}

const scripted = (script: CompletionResponse[]): RequestFn => {
	let index = 0
	return () => {
		const next = script[index]
		index += 1
		return next ? Promise.resolve(next) : Promise.reject(new Error('the script ran out'))
	}
}

const getCase = (id: string): EvalCase => {
	const found = RECIPE_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

const ingredient = (name: string, grams: number, kcal: number) => ({
	name,
	grams,
	kcal,
	protein: 5,
	fat: 3,
	carbs: 10,
	fiber: null,
})

const BORSCHT_POT = [
	ingredient('Яловичина', 500, 1000),
	ingredient('Капуста', 300, 75),
	ingredient('Буряк', 200, 86),
	ingredient('Картопля', 200, 154),
	ingredient('Морква', 100, 41),
]

const item = (overrides: object) => ({
	name: 'Борщ',
	grams: 850,
	kcal: 200,
	protein: 10,
	fat: 8,
	carbs: 20,
	category: 'borscht',
	source: 'ESTIMATE',
	confidence: 0.8,
	fiber: null,
	quantity: null,
	assumption: null,
	memoryRef: null,
	copyRef: null,
	...overrides,
})

const logFood = (items: object[], reply = 'Записав борщ, 850 г. Зберегти рецепт?'): Call => ({
	id: 'c1',
	name: 'log_food',
	args: { items, reply },
})

const reply = (text: string, id = 'c2'): Call => ({ id, name: 'reply', args: { text } })

const run = async (id: string, calls: Call[][]) => {
	const evalCase = getCase(id)
	const result = await runCase(evalCase, OPTIONS, scripted(calls.map(completion)))
	return { evalCase, result }
}

describe('recipe cases through runCase', () => {
	it('counts a pot from its ingredients, not from the model number, and judges its recipe', async () => {
		const { evalCase, result } = await run('soup-pot-recipe-field', [
			[logFood([item({ kcal: 999, recipe: { ingredients: BORSCHT_POT, waterMl: 5000 } })])],
		])

		// 1356 kcal in 1300 g + 5000 ml → 850 g carry ≈ 183 kcal, whatever the model wrote in kcal
		expect(result.error).toBeNull()
		expect(result.kcal).toBeCloseTo((1356 * 850) / 6300, 1)
		expect(result.items[0]?.recipe).toMatchObject({ waterMl: 5000, cookedGrams: null })
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
		expect(isDecisionCorrect(evalCase, result.decision, result.replyText)).toBe(true)
	})

	it('fails a pot with the wrong water, and one that was saved before the user agreed', async () => {
		const wrongWater = await run('soup-pot-recipe-field', [
			[logFood([item({ recipe: { ingredients: BORSCHT_POT, waterMl: 3000 } })])],
		])
		expect(isCaseMemoryCorrect(wrongWater.evalCase, wrongWater.result)).toBe(false)

		const savedEarly = await run('soup-pot-recipe-field', [
			[
				logFood([item({ recipe: { ingredients: BORSCHT_POT, waterMl: 5000 } })]),
				{
					id: 'c2',
					name: 'save_recipe',
					args: {
						name: 'Борщ',
						entryRef: null,
						recipe: { ingredients: BORSCHT_POT },
						portionGrams: 400,
					},
				},
			],
		])
		expect(isCaseMemoryCorrect(savedEarly.evalCase, savedEarly.result)).toBe(false)
	})

	it('takes the kcal of a recipeRef item from the saved recipe', async () => {
		const { evalCase, result } = await run('recipe-again-other-day', [
			[logFood([item({ grams: 400, kcal: 500, recipeRef: 'r1' })], 'Записав борщ.')],
		])

		const per100 = (result.kcal ?? 0) / 4
		expect(result.items[0]?.recipeRef).toBe('r1')
		expect(result.kcal).toBeGreaterThan(0)
		expect(result.kcal).toBeLessThan(500)
		expect(per100).toBeCloseTo((SAVED_BORSCHT.waterMl === 3000 ? 1356 / 4300 : 0) * 100, 0)
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
	})

	it('saves a logged pot by its e-ref after «так», and nothing else', async () => {
		const { evalCase, result } = await run('recipe-save-after-yes', [
			[
				{ id: 'c1', name: 'save_recipe', args: { name: 'Борщ', entryRef: 'e1' } },
				reply('Зберіг рецепт борщу.'),
			],
		])

		expect(result.error).toBeNull()
		expect(result.calls.savedRecipes).toEqual([
			{ name: 'Борщ', entryRef: 'e1', portionGrams: null, recipe: null },
		])
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
		expect(isDecisionCorrect(evalCase, result.decision, result.replyText)).toBe(true)
	})

	it('reads «там було 4 л» as the pot correction, with no new grams or values', async () => {
		const { evalCase, result } = await run('recipe-water-correction', [
			[
				{
					id: 'c1',
					name: 'correct_entry',
					args: { changes: [{ ref: 'e1', recipe: { waterMl: 4000 } }] },
				},
				reply('Виправив воду: 4 л, порції перераховано.'),
			],
		])

		expect(result.error).toBeNull()
		expect(result.edits?.corrections[0]?.pot).toEqual({ waterMl: 4000, cookedGrams: null })
		expect(evalCase.expect.edits && isEditsCorrect(evalCase.expect.edits, result.edits)).toBe(true)
		const wrong = {
			corrected: [{ ref: 'e1', recipe: { waterMl: 3000 } }],
		}
		expect(isEditsCorrect(wrong, result.edits)).toBe(false)
	})

	it('records the water of every clarify option, «Не знаю» with null', async () => {
		const option = (label: string, kcal: number, waterMl: number | null) => ({
			label,
			kcal,
			protein: 20,
			fat: 10,
			// kcal = 4·protein + 4·carbs + 9·fat, as the parser checks
			carbs: (kcal - 4 * 20 - 9 * 10) / 4,
			waterMl,
		})
		const { evalCase, result } = await run('soup-pot-no-water-clarify', [
			[
				logFood(
					[
						item({
							name: 'Гороховий суп',
							grams: 600,
							category: 'soup',
							recipe: {
								ingredients: [
									ingredient('Горох', 250, 850),
									ingredient('Копчена курка', 300, 600),
									ingredient('Картопля', 200, 154),
									ingredient('Морква', 100, 41),
								],
								waterMl: 3000,
							},
						}),
					],
					'Записав суп, оцінив 3 л води.',
				),
				{
					id: 'c2',
					name: 'clarify',
					args: {
						question: 'Скільки води було в каструлі?',
						itemIndexes: [0],
						options: [
							option('1–2 л', 400, 1500),
							option('3 л', 250, 3000),
							option('4–5 л', 170, 4500),
							option('Не знаю', 250, null),
						],
					},
				},
			],
		])

		expect(result.error).toBeNull()
		expect(result.clarifyCalls[0]?.options.map(({ waterMl }) => waterMl)).toEqual([
			1500,
			3000,
			4500,
			null,
		])
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
	})

	it('accepts only a question about the ingredients for «Новий рецепт» with a bare word', async () => {
		const asked = await run('recipe-new-intent-no-ingredients', [
			[reply('Що входить до рецепта і скільки кожного?')],
		])
		expect(isCaseMemoryCorrect(asked.evalCase, asked.result)).toBe(true)
		expect(isDecisionCorrect(asked.evalCase, asked.result.decision, asked.result.replyText)).toBe(
			true,
		)

		const invented = await run('recipe-new-intent-no-ingredients', [
			[
				{
					id: 'c1',
					name: 'save_recipe',
					args: {
						name: 'Тест',
						recipe: { ingredients: BORSCHT_POT, servings: 4 },
						portionGrams: 300,
					},
				},
				reply('Зберіг рецепт.'),
			],
		])
		expect(invented.result.error).toBeNull()
		expect(isCaseMemoryCorrect(invented.evalCase, invented.result)).toBe(false)
	})

	it('judges the saved recipe of «Новий рецепт»: the ingredients and the portion, no log', async () => {
		const { evalCase, result } = await run('recipe-new-intent', [
			[
				{
					id: 'c1',
					name: 'save_recipe',
					args: {
						name: 'Борщ',
						recipe: { ingredients: BORSCHT_POT, waterMl: 4000, servings: 8 },
						portionGrams: 400,
					},
				},
				reply('Зберіг рецепт борщу: 8 порцій по 400 г.'),
			],
		])

		expect(result.error).toBeNull()
		expect(isCaseMemoryCorrect(evalCase, result)).toBe(true)
	})

	it('shows the saved composition after find_food, and rejects an invented ingredient', async () => {
		const find: Call = { id: 'c1', name: 'find_food', args: { query: 'борщ', scope: 'saved' } }
		const answer = (text: string) => [[find], [reply(text, 'c3')]]

		const shown = await run(
			'recipe-show-saved',
			answer('Борщ: яловичина 500 г, капуста 300 г, буряк 200 г, картопля 200 г, морква 100 г.'),
		)
		expect(shown.result.reads?.findFoodCalls).toBe(1)
		expect(isCaseMemoryCorrect(shown.evalCase, shown.result)).toBe(true)
		expect(isDecisionCorrect(shown.evalCase, shown.result.decision, shown.result.replyText)).toBe(
			true,
		)

		const invented = await run(
			'recipe-show-saved',
			answer('Борщ: яловичина 500 г, капуста, квасоля, часник.'),
		)
		expect(
			isDecisionCorrect(invented.evalCase, invented.result.decision, invented.result.replyText),
		).toBe(false)
	})
})
