import { describe, expect, it } from 'vitest'

import { entry } from './cases/case-builders.js'
import type { HistoryEntryFixture } from './cases/case.types.js'
import type { EvalCase } from './cases/index.js'
import { createReadExecutor, createReadTurn, getReadCalls, runReadStep } from './read-loop.js'
import { savedFood } from './read-fixtures.js'
import { buildCaseContext } from './run-case.js'

const bar = savedFood({
	name: 'Батончик SportyFeel',
	per100g: { kcal: 376, protein: 33, fat: 12, carbs: 30 },
	pieceGrams: 45,
	category: 'protein_bar',
})

const history = (overrides: Partial<HistoryEntryFixture>): HistoryEntryFixture => ({
	date: '2026-10-05',
	mealType: 'SNACK',
	name: 'Протеїновий батончик SportyFeel',
	grams: 45,
	kcal: 170,
	source: 'LABEL',
	...overrides,
})

const makeCase = (overrides: Partial<EvalCase>): EvalCase => ({
	id: 'c',
	text: 'x',
	expect: { decision: 'log' },
	reference: 'r',
	...overrides,
})

const call = (query: string, scope = 'all') => ({
	name: 'find_food',
	arguments: JSON.stringify({ query, scope }),
})

const read = (evalCase: EvalCase, query: string, scope = 'all') => {
	const execute = createReadExecutor(evalCase, buildCaseContext(evalCase))
	return execute(call(query, scope))
}

describe('createReadExecutor', () => {
	it('finds a saved food by the shared search and hands out the next m-ref with its values', () => {
		const outcome = read(makeCase({ savedFoods: [bar] }), 'sportyfeel')

		expect(outcome.text).toContain('m1 "Батончик SportyFeel"')
		expect(outcome.refsPatch).toEqual({ memoryRefs: ['m1'], copyRefs: [] })
		expect(outcome.memory).toEqual([
			expect.objectContaining({ ref: 'm1', name: 'Батончик SportyFeel', per100g: bar.per100g }),
		])
	})

	it('continues the numbering after the refs the request already carries', () => {
		const other = savedFood({
			name: 'Гречка',
			per100g: { kcal: 110, protein: 4, fat: 1, carbs: 21 },
		})
		// the message names the buckwheat: it is m1 in the block, the bar found later is m2
		const evalCase = makeCase({ text: 'гречка', savedFoods: [bar, other] })

		expect(read(evalCase, 'батончик').text).toContain('m2 "Батончик SportyFeel"')
	})

	it('does not hand out a new ref for a food the block already carries', () => {
		const evalCase = makeCase({ text: 'sportyfeel', savedFoods: [bar] })

		const outcome = read(evalCase, 'sportyfeel')

		expect(outcome.text).toContain('m1 "Батончик SportyFeel"')
		expect(outcome.memory).toEqual([])
	})

	it('searches the history: h-refs continue after the earlier ones and carry the entry values', () => {
		const evalCase = makeCase({
			historyEntries: [
				history({}),
				history({ date: '2026-10-01', name: 'Курка гриль', kcal: 240 }),
			],
		})

		const outcome = read(evalCase, 'батончик', 'history')

		expect(outcome.text).toContain(
			'h1 2026-10-05 SNACK "Протеїновий батончик SportyFeel" 45 g 170 kcal LABEL',
		)
		expect(outcome.refsPatch).toEqual({ memoryRefs: [], copyRefs: ['h1'] })
		expect(outcome.earlier).toEqual([
			expect.objectContaining({ ref: 'h1', kcal: 170, grams: 45, date: '2026-10-05' }),
		])
	})

	it("numbers h-refs after the case's own earlier entries", () => {
		const evalCase = makeCase({
			context: {
				earlier: [
					{ ref: 'h4', date: '2026-10-02', mealType: 'LUNCH', name: 'Суп', grams: 300, kcal: 150 },
				],
			},
			historyEntries: [history({})],
		})

		expect(read(evalCase, 'батончик', 'history').refsPatch.copyRefs).toEqual(['h5'])
	})

	it("sees only the last 90 days before the case's today", () => {
		const evalCase = makeCase({
			historyEntries: [
				history({ date: '2026-06-01' }), // too old
				history({ date: '2026-10-07', name: 'Сьогоднішній батончик' }), // today is not "earlier"
			],
		})

		expect(read(evalCase, 'батончик', 'history').text).toBe('No match for "батончик"')
	})

	it('says «No match» when nothing fits, and the model gets no ref', () => {
		const outcome = read(makeCase({ savedFoods: [bar] }), 'йогурт')

		expect(outcome.text).toBe('No match for "йогурт"')
		expect(outcome.refsPatch).toEqual({ memoryRefs: [], copyRefs: [] })
	})

	it('answers invalid arguments with an error text instead of failing the case', () => {
		const execute = createReadExecutor(makeCase({}), buildCaseContext(makeCase({})))

		expect(execute({ name: 'find_food', arguments: '{"query":""}' }).text).toContain(
			'invalid arguments',
		)
	})

	it('lists the saved foods of the case when find_food has no query', () => {
		const evalCase = makeCase({ savedFoods: [bar] })
		const execute = createReadExecutor(evalCase, buildCaseContext(evalCase))

		const outcome = execute({ name: 'find_food', arguments: '{"scope":"saved"}' })

		expect(outcome.text).toContain('m1 "Батончик SportyFeel"')
		expect(outcome.text).toContain('1 saved in total; ask a name to narrow')
		expect(outcome.refsPatch).toEqual({ memoryRefs: ['m1'], copyRefs: [] })
		expect(outcome.memory.map((food) => food.ref)).toEqual(['m1'])
		expect(execute({ name: 'find_food', arguments: '{"scope":"all"}' }).text).toContain(
			'invalid arguments',
		)
	})

	it('refuses an unknown read tool', () => {
		const execute = createReadExecutor(makeCase({}), buildCaseContext(makeCase({})))

		expect(() => execute({ name: 'get_food_log', arguments: '{}' })).toThrow('unknown read tool')
	})

	it("keeps the refs of today's entries out of the h-numbering", () => {
		const evalCase = makeCase({
			context: { entries: [entry('e1', 'Банан', 'SNACK', 120, 107, 'banana')] },
			historyEntries: [history({})],
		})

		expect(read(evalCase, 'батончик', 'history').refsPatch.copyRefs).toEqual(['h1'])
	})
})

describe('runReadStep', () => {
	it('counts one round and every find_food call, and collects the refs of all calls', () => {
		const evalCase = makeCase({ savedFoods: [bar], historyEntries: [history({})] })
		const execute = createReadExecutor(evalCase, buildCaseContext(evalCase))
		const turn = createReadTurn()

		runReadStep(turn, execute, [call('sportyfeel', 'saved'), call('батончик', 'history')])

		expect(turn.stats).toEqual({ steps: 1, findFoodCalls: 2 })
		expect(turn.refsPatch).toEqual({ memoryRefs: ['m1'], copyRefs: ['h1'] })
		expect(turn.memory).toHaveLength(1)
		expect(turn.earlier).toHaveLength(1)
	})
})

describe('getReadCalls', () => {
	it('takes the read calls only and at most four', () => {
		const calls = [
			{ name: 'log_food', arguments: '{}' },
			...Array.from({ length: 6 }, () => call('x')),
		]

		expect(getReadCalls(calls)).toHaveLength(4)
	})
})

describe('get_workouts in the read loop', () => {
	const workoutsCall = (args: unknown) => ({
		name: 'get_workouts',
		arguments: JSON.stringify(args),
	})
	const withFixture = makeCase({
		workoutsRead: {
			from: '2026-11-01',
			to: '2026-11-10',
			days: 10,
			firstEverDate: '2025-09-03',
			totalEver: 84,
			exercise: null,
			periodCount: 0,
			count: 0,
			firstDate: null,
			lastDate: null,
			avgDurationMin: null,
			hasEstimatedDuration: false,
			workingSets: 0,
			sessions: [],
			olderNotListed: 0,
			exercises: [],
			records: [],
			program: null,
			hasOpenSession: false,
		},
	})

	it("answers with the shared formatter over the case's fixture", () => {
		const execute = createReadExecutor(withFixture, buildCaseContext(withFixture))

		const outcome = execute(workoutsCall({ days: 10 }))

		expect(outcome.text).toContain('First workout ever: 2025-09-03; all time: 84 workouts.')
		expect(outcome.text).toContain('No workouts in this period.')
		expect(outcome.refsPatch).toEqual({})
	})

	it('answers a case without a fixture with an empty log, and invalid arguments with an error text', () => {
		const plain = makeCase({})
		const execute = createReadExecutor(plain, buildCaseContext(plain))

		expect(execute(workoutsCall({ days: 7 })).text).toContain('all time: 0 workouts.')
		expect(execute(workoutsCall({ days: 93 })).text).toContain('invalid arguments')
	})

	it('counts the valid calls with their arguments, not the invalid ones', () => {
		const execute = createReadExecutor(withFixture, buildCaseContext(withFixture))
		const turn = createReadTurn()

		runReadStep(turn, execute, [
			workoutsCall({ days: 10 }),
			workoutsCall({ days: 0 }),
			workoutsCall({ days: 7, endDate: '2026-11-08', exercise: 'жим' }),
		])

		expect(turn.stats.getWorkouts).toEqual([
			{ days: 10, endDate: null, exercise: null },
			{ days: 7, endDate: '2026-11-08', exercise: 'жим' },
		])
		expect(turn.stats.findFoodCalls).toBe(0)
	})

	it('leaves the stats of a find_food-only round without the field', () => {
		const evalCase = makeCase({ savedFoods: [bar] })
		const turn = createReadTurn()

		runReadStep(turn, createReadExecutor(evalCase, buildCaseContext(evalCase)), [
			call('sportyfeel'),
		])

		expect(turn.stats).toEqual({ steps: 1, findFoodCalls: 1 })
	})
})
