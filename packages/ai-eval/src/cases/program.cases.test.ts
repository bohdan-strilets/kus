import { formatContext, getParseRefs, isProgramTopic } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { isCaseProgramCorrect } from '../metrics.js'
import type { CaseResult, LoggedProgram } from '../eval.types.js'
import { buildCaseContext } from '../run-case.js'
import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { PROGRAM_CASES } from './program.cases.js'

const byId = (id: string) => PROGRAM_CASES.find((item) => item.id === id)

describe('program cases', () => {
	it('are valid cases with ids unique across the repo set', () => {
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of PROGRAM_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
		expect(PROGRAM_CASES).toHaveLength(14)
	})

	it('ask for a program only where one is expected', () => {
		const proposing = PROGRAM_CASES.filter(({ expect: want }) => want.decision === 'program')
		expect(proposing.map(({ id }) => id)).toEqual([
			'program-propose',
			'program-swap-leg-press',
			'program-keeps-custom-names',
			'program-edit-pending',
			'program-newbie-home',
			'program-always-a',
		])
		for (const evalCase of proposing) expect(evalCase.expect.program, evalCase.id).toBeDefined()
	})

	it('give the model the «Program» rules without a program: the topic or the onboarding', () => {
		const newbie = byId('program-newbie-home')
		expect(newbie?.context?.program).toBeUndefined()
		expect(isProgramTopic(newbie?.text ?? '')).toBe(true)
		expect(byId('program-propose')?.context?.programOnboarding).toContain('3 per week')
	})

	it('bind the log cases to the t-ref of the template they repeat', () => {
		const bound = byId('program-log-bound')
		expect(bound?.expect.workouts?.[0]?.templateRef).toBe('t2')
		expect(bound?.context?.program?.templates.find(({ ref }) => ref === 't2')?.name).toBe(
			'Тренування Б',
		)
		expect(byId('program-log-unbound')?.expect.workouts?.[0]?.templateRef).toBeNull()
	})

	it('pin to a template that exists in the case program', () => {
		const always = byId('program-always-a')
		const name = always?.expect.program?.pinnedRefOf
		expect(always?.context?.program?.templates.some((template) => template.name === name)).toBe(
			true,
		)
	})

	it('show the open proposal after the rules header and judge refs against it', () => {
		const pending = byId('program-edit-pending')
		if (!pending) throw new Error('program-edit-pending is missing')
		const context = buildCaseContext(pending)
		const text = formatContext(context)

		expect(context.program).toBeUndefined()
		expect(text).toContain(
			'# Program\nProposal not accepted yet (the card in the chat), build changes on it:\nROTATE, 2 per week.\nt1 "Тренування А": Жим лежачи 3×8–12;',
		)
		expect(text).toContain('t2 "Тренування Б": Жим ногами 3×10–12;')
		expect(text).not.toContain('Active: ')
		expect([...(getParseRefs(context).templateRefs ?? [])]).toEqual(['t1', 't2'])

		const [templateA, templateB] = pending.context?.pendingProgram?.templates ?? []
		const toLogged = (refs: (string | null)[], squat: boolean): LoggedProgram => ({
			mode: 'ROTATE',
			pinnedRef: null,
			templates: [
				{
					ref: refs[0] ?? null,
					name: templateA?.name ?? '',
					weekdays: [],
					exercises: (templateA?.exercises ?? []).map(({ name }) => ({ name, weightKg: null })),
				},
				{
					ref: refs[1] ?? null,
					name: templateB?.name ?? '',
					weekdays: [],
					exercises: [
						{ name: squat ? 'Присідання' : 'Жим ногами', weightKg: null },
						{ name: 'Румунська тяга', weightKg: null },
					],
				},
			],
		})
		const judge = (program: LoggedProgram): boolean =>
			isCaseProgramCorrect(pending, { program } as CaseResult)

		expect(judge(toLogged(['t1', 't2'], true))).toBe(true)
		expect(judge(toLogged([null, null], true))).toBe(false)
		expect(judge(toLogged(['t1', 't2'], false))).toBe(false)
	})

	it('make the late session older than 3 h at the case clock', () => {
		const [workout] = byId('e2-two-more-sets-late')?.context?.workouts ?? []
		expect(workout?.lastAt).toBe('15:30')
		expect(byId('e2-two-more-sets-late')?.context?.localTime).toContain('19:30')
		expect(byId('e2-two-more-sets')?.context?.workouts?.[0]?.lastAt).toBe('19:10')
	})
})
