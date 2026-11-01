import { describe, expect, it } from 'vitest'

import {
	PROGRAM_EXERCISES_PER_TEMPLATE_MAX,
	PROGRAM_TEMPLATES_MAX,
	PROGRESS_STEP_OPTIONS_KG,
	programCardSchema,
	programDraftSchema,
	programTemplateSchema,
	templateExerciseTargetSchema,
	weekdaysSchema,
} from './programs.js'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const validTarget = {
	sets: 3,
	repsMin: 8,
	repsMax: 10,
	weightKg: 60,
	progressStepKg: 2.5,
	restSec: 90,
	durationMin: null,
	distanceM: null,
}

const validExercise = {
	name: 'Жим лежачи',
	exerciseId: null,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	target: validTarget,
}

const validTemplate = (n: number) => ({
	key: uuid(n),
	name: `День ${n}`,
	weekdays: [1, 3],
	exercises: [validExercise],
	estimatedMin: 55,
})

const validProgram = {
	title: 'Сила',
	mode: 'WEEKDAYS',
	perWeek: 3,
	templates: [validTemplate(1)],
}

const isTargetValid = (overrides: Record<string, unknown>): boolean =>
	templateExerciseTargetSchema.safeParse({ ...validTarget, ...overrides }).success

describe('templateExerciseTargetSchema', () => {
	it('accepts a valid target and an all-null target', () => {
		expect(templateExerciseTargetSchema.safeParse(validTarget).success).toBe(true)
		const allNull = Object.fromEntries(Object.keys(validTarget).map((key) => [key, null]))
		expect(templateExerciseTargetSchema.safeParse(allNull).success).toBe(true)
	})

	it('rejects repsMin greater than repsMax and points at repsMax', () => {
		const result = templateExerciseTargetSchema.safeParse({
			...validTarget,
			repsMin: 12,
			repsMax: 8,
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['repsMax'])
	})

	it('accepts repsMin equal to repsMax and a one-sided range', () => {
		expect(isTargetValid({ repsMin: 8, repsMax: 8 })).toBe(true)
		expect(isTargetValid({ repsMin: 12, repsMax: null })).toBe(true)
	})

	it('rejects sets 0 and 11, accepts 1 and 10', () => {
		expect(isTargetValid({ sets: 0 })).toBe(false)
		expect(isTargetValid({ sets: 11 })).toBe(false)
		expect(isTargetValid({ sets: 1 })).toBe(true)
		expect(isTargetValid({ sets: 10 })).toBe(true)
	})

	it('rejects non-integer sets and reps', () => {
		expect(isTargetValid({ sets: 2.5 })).toBe(false)
		expect(isTargetValid({ repsMin: 7.5 })).toBe(false)
	})

	it('rejects weight over 500 and negative weight, accepts 0 and 500', () => {
		expect(isTargetValid({ weightKg: 500.5 })).toBe(false)
		expect(isTargetValid({ weightKg: -1 })).toBe(false)
		expect(isTargetValid({ weightKg: 0 })).toBe(true)
		expect(isTargetValid({ weightKg: 500 })).toBe(true)
	})

	it('rejects reps over 100 and rest outside 15–600', () => {
		expect(isTargetValid({ repsMax: 101 })).toBe(false)
		expect(isTargetValid({ restSec: 14 })).toBe(false)
		expect(isTargetValid({ restSec: 601 })).toBe(false)
	})

	it('rejects a progress step of zero, negative, or over the hard cap', () => {
		for (const progressStepKg of [0, -1, 20.5]) {
			expect(isTargetValid({ progressStepKg })).toBe(false)
		}
	})

	// Plan 0.10.2 (limits): the step is one of {1, 2.5, 5}.
	it('accepts only the progress steps from PROGRESS_STEP_OPTIONS_KG', () => {
		expect([...PROGRESS_STEP_OPTIONS_KG]).toEqual([1, 2.5, 5])
		for (const progressStepKg of PROGRESS_STEP_OPTIONS_KG) {
			expect(isTargetValid({ progressStepKg })).toBe(true)
		}
		expect(isTargetValid({ progressStepKg: 3 })).toBe(false)
	})
})

describe('weekdaysSchema', () => {
	it('accepts an empty list and valid unique days', () => {
		expect(weekdaysSchema.safeParse([]).success).toBe(true)
		expect(weekdaysSchema.safeParse([1, 3, 7]).success).toBe(true)
	})

	it('rejects duplicate weekdays', () => {
		expect(weekdaysSchema.safeParse([1, 1]).success).toBe(false)
	})

	it('rejects days outside 1–7', () => {
		expect(weekdaysSchema.safeParse([0]).success).toBe(false)
		expect(weekdaysSchema.safeParse([8]).success).toBe(false)
	})
})

describe('programTemplateSchema / programDraftSchema', () => {
	it('rejects more than 15 exercises in a template, accepts 15', () => {
		const withExercises = (count: number) => ({
			...validTemplate(1),
			exercises: Array.from({ length: count }, () => validExercise),
		})
		expect(PROGRAM_EXERCISES_PER_TEMPLATE_MAX).toBe(15)
		expect(programTemplateSchema.safeParse(withExercises(15)).success).toBe(true)
		expect(programTemplateSchema.safeParse(withExercises(16)).success).toBe(false)
	})

	it('rejects more than 7 templates, accepts 7', () => {
		const withTemplates = (count: number) => ({
			...validProgram,
			templates: Array.from({ length: count }, (_, index) => validTemplate(index + 1)),
		})
		expect(PROGRAM_TEMPLATES_MAX).toBe(7)
		expect(programDraftSchema.safeParse(withTemplates(7)).success).toBe(true)
		expect(programDraftSchema.safeParse(withTemplates(8)).success).toBe(false)
	})

	it('rejects a program without templates', () => {
		expect(programDraftSchema.safeParse({ ...validProgram, templates: [] }).success).toBe(false)
	})

	it('rejects an unknown mode and perWeek over 7', () => {
		expect(programDraftSchema.safeParse({ ...validProgram, mode: 'DAILY' }).success).toBe(false)
		expect(programDraftSchema.safeParse({ ...validProgram, perWeek: 8 }).success).toBe(false)
	})

	it('rejects a whitespace-only template name', () => {
		const template = { ...validTemplate(1), name: '   ' }
		expect(programTemplateSchema.safeParse(template).success).toBe(false)
	})

	it('rejects duplicate weekdays inside a template', () => {
		const template = { ...validTemplate(1), weekdays: [2, 2] }
		expect(programTemplateSchema.safeParse(template).success).toBe(false)
	})
})

describe('programCardSchema', () => {
	const validCard = {
		v: 1,
		baseVersionId: null,
		program: validProgram,
		changes: {
			v: 1,
			initial: false,
			unchangedTemplates: 1,
			lines: [
				{
					op: 'CHANGE',
					scope: 'EXERCISE',
					templateName: 'День 1',
					name: 'Жим лежачи',
					field: 'target',
					before: validTarget,
					after: { ...validTarget, sets: 4 },
				},
				{
					op: 'CHANGE',
					scope: 'TEMPLATE',
					templateName: 'День 1',
					name: null,
					field: 'weekdays',
					before: [1],
					after: [1, 3],
				},
				{
					op: 'REORDER',
					scope: 'TEMPLATE',
					templateName: 'День 1',
					name: null,
					field: null,
					before: null,
					after: null,
				},
			],
		},
	}

	it('round-trips a valid card unchanged', () => {
		const parsed = programCardSchema.parse(validCard)
		expect(parsed).toEqual(validCard)
		expect(programCardSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(validCard)
	})

	it('accepts a baseVersionId uuid', () => {
		expect(programCardSchema.safeParse({ ...validCard, baseVersionId: uuid(9) }).success).toBe(true)
	})

	it('rejects a wrong version or a non-uuid baseVersionId', () => {
		expect(programCardSchema.safeParse({ ...validCard, v: 2 }).success).toBe(false)
		expect(programCardSchema.safeParse({ ...validCard, baseVersionId: 'x' }).success).toBe(false)
	})

	it('rejects an invalid program inside the card', () => {
		const program = { ...validProgram, templates: [] }
		expect(programCardSchema.safeParse({ ...validCard, program }).success).toBe(false)
	})
})
