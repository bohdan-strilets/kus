import { formatGetWorkoutsResult, workoutsReadDataSchema } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { WORKOUTS_READ_CASES } from './workouts-read.cases.js'

const byId = (id: string) => {
	const found = WORKOUTS_READ_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

const resultOf = (id: string): string => {
	const { workoutsRead } = byId(id)
	if (!workoutsRead) throw new Error(`no fixture in ${id}`)
	return formatGetWorkoutsResult(workoutsRead)
}

describe('get_workouts cases', () => {
	it('are the twelve cases of 0.11.2 and 0.11.3, valid, with ids unique across the repo set', () => {
		expect(WORKOUTS_READ_CASES).toHaveLength(12)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of WORKOUTS_READ_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
			if (evalCase.workoutsRead) {
				expect(workoutsReadDataSchema.safeParse(evalCase.workoutsRead).success, evalCase.id).toBe(
					true,
				)
			}
		}
	})

	it('expect a call or none for the right reason', () => {
		for (const evalCase of WORKOUTS_READ_CASES) {
			expect(evalCase.expect.getWorkouts, evalCase.id).toBeDefined()
		}
		expect(byId('read-workouts-today-no-call').expect.getWorkouts).toEqual({ called: false })
		expect(byId('read-workouts-log-no-read').expect.getWorkouts).toEqual({ called: false })
		expect(byId('read-workouts-month-count').expect.getWorkouts).toMatchObject({
			days: { min: 10, max: 10 },
			endDateNull: true,
		})
	})

	it("show today's workout in the context of the case that must not read", () => {
		expect(byId('read-workouts-today-no-call').context?.workouts?.[0]?.ref).toBe('w1')
	})

	it('give the model the numbers the replies are judged by', () => {
		expect(resultOf('read-workouts-first-ever')).toContain('First workout ever: 2025-09-03')
		expect(resultOf('read-workouts-month-count')).toContain('Workouts: 4')
		expect(resultOf('read-workouts-bench-record')).toContain('best ever 85 kg×5 on 2026-11-03')
		expect(resultOf('read-workouts-month-review')).toContain('planned 12, done 10')
		expect(resultOf('read-workouts-missed-program')).toContain('planned 9, done 7')
		expect(resultOf('read-workouts-empty-week')).toContain('No workouts in this period.')
		expect(resultOf('read-workouts-empty-week')).toContain('all time: 84 workouts.')
	})

	it('tell the program check apart from the count, and the unfinished week from a miss', () => {
		const program = resultOf('read-workouts-month-count-program')
		expect(program).toContain(
			'Plan check counts only whole Mon–Sun weeks of the period that are over: 02.11–08.11',
		)
		expect(program).toContain("Not in the check: 2 of the period's 3 workouts")
		expect(resultOf('read-workouts-this-week')).toContain('This week so far: 1 of 3 (not over).')
		expect(resultOf('read-workouts-this-week')).toContain('No whole week of the period is over yet')
	})

	it('give the two presses of one spoken name apart, and the history marker of the earlier read', () => {
		const text = resultOf('read-workouts-prior-marker')
		expect(text).toContain('Matched exercises: "Жим від грудей"; "Жим лежачи"')
		expect(text).toContain('Workouts with it: 2 of 30 in the period')
		const marked = byId('read-workouts-prior-marker').context?.history?.at(-1)
		expect(marked?.reads?.[0]).toMatch(/^read workouts 01\.11–10\.11: 3 \(01\.11, 05\.11, 09\.11\)/)
		expect(byId('read-workouts-prior-no-marker').context?.history?.at(-1)).not.toHaveProperty(
			'reads',
		)
	})
})
