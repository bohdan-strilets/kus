import type { ProgramExerciseResponse, ProgramTemplateResponse } from '@kus/shared'

export const TEMPLATE_ID = '0199b3a4-0000-7000-8000-0000000000a0'

/** Tests only: «Жим лежачи» 3 × 8–10 · 50 кг of a template. */
export const makeTemplateExercise = (
	overrides: Partial<ProgramExerciseResponse> = {},
): ProgramExerciseResponse => ({
	id: '0199b3a4-0000-7000-8000-0000000000b1',
	exerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	position: 0,
	target: {
		sets: 3,
		repsMin: 8,
		repsMax: 10,
		weightKg: 50,
		progressStepKg: null,
		restSec: null,
		durationMin: null,
		distanceM: null,
	},
	lastSets: null,
	lastPerformedAt: null,
	isBodyweight: null,
	progressHintKg: null,
	...overrides,
})

/** Tests only: a template with one strength exercise and a 55 min estimate. */
export const makeTemplate = (
	overrides: Partial<ProgramTemplateResponse> = {},
): ProgramTemplateResponse => ({
	id: TEMPLATE_ID,
	key: TEMPLATE_ID,
	name: 'Верх А',
	position: 0,
	weekdays: [],
	estimatedMin: 55,
	muscleGroups: ['CHEST'],
	hasCardio: false,
	exercises: [makeTemplateExercise()],
	...overrides,
})
