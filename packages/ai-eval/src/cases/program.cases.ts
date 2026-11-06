// Workout programs (0.10.2): propose_program (new, changed in words, SINGLE), talking about a
// program without proposing, binding a log_workout to a template (templateRef), plus the risks of
// the shorter tool descriptions (E2): body weight without a weight, «ще 2 підходи» into an open
// session, a clarify next to an estimate. Synthetic data only. Clock: Wed 2026-10-07 evening.
import type {
	ExerciseContext,
	FoodParseContext,
	ProgramContext,
	ProgramExerciseContext,
	ProgramProposalContext,
	ProgramTemplateContext,
	TodayWorkoutContext,
	WorkoutSetContext,
} from '@kus/shared'

import { atClock, range } from './case-builders.js'
import type { EvalCase } from './case.types.js'

const EVENING = atClock('2026-10-07 19:30, Wednesday')
const LAST_DONE = '2026-10-05'
const PLAN_SETS = 3
const MAX_TEMPLATE_EXERCISES = 12

const sets = (count: number, reps: number, weightKg: number | null): WorkoutSetContext[] =>
	Array.from({ length: count }, () => ({ reps, weightKg, isWarmup: false }))

const planned = (
	name: string,
	exerciseRef: string,
	repsMin: number,
	repsMax: number,
	weightKg: number,
): ProgramExerciseContext => ({
	name,
	exerciseRef,
	sets: PLAN_SETS,
	repsMin,
	repsMax,
	weightKg,
	durationMin: null,
	distanceKm: null,
})

const TEMPLATE_A: ProgramTemplateContext = {
	ref: 't1',
	name: 'Тренування А',
	weekdays: [],
	exercises: [
		planned('Жим лежачи', 'x1', 8, 10, 60),
		planned('Тяга верхнього блоку', 'x2', 10, 12, 50),
		planned('Жим гантелей сидячи', 'x3', 10, 12, 16),
		planned('Розгинання рук на блоці', 'x4', 12, 15, 25),
	],
}

/** Б: exactly the four exercises the log cases repeat. */
const TEMPLATE_B: ProgramTemplateContext = {
	ref: 't2',
	name: 'Тренування Б',
	weekdays: [],
	exercises: [
		planned('Жим ногами', 'x5', 10, 12, 120),
		planned('Тяга горизонтального блоку', 'x6', 12, 12, 50),
		planned('Румунська тяга', 'x7', 10, 12, 60),
		planned('Згинання ніг лежачи', 'x8', 12, 15, 35),
	],
}

const ROTATE_PROGRAM: ProgramContext = {
	mode: 'ROTATE',
	perWeek: 2,
	title: 'Все тіло',
	nextRef: 't1',
	templates: [TEMPLATE_A, TEMPLATE_B],
}

/** «Exercises»: every exercise of the program was done on Mon with its planned weight. */
const PROGRAM_HISTORY: ExerciseContext[] = [TEMPLATE_A, TEMPLATE_B].flatMap(({ exercises }) =>
	exercises.flatMap((exercise): ExerciseContext[] =>
		exercise.exerciseRef === null
			? []
			: [
					{
						ref: exercise.exerciseRef,
						name: exercise.name,
						kind: 'STRENGTH',
						last: {
							date: LAST_DONE,
							sets: sets(PLAN_SETS, exercise.repsMax ?? 0, exercise.weightKg),
							durationMin: null,
							distanceKm: null,
						},
					},
				],
	),
)

export const WITH_PROGRAM: Partial<FoodParseContext> = {
	...EVENING,
	program: ROTATE_PROGRAM,
	exercises: PROGRAM_HISTORY,
}

/** «Завжди А»: the same two templates, only A is done. */
export const WITH_SINGLE_PROGRAM: Partial<FoodParseContext> = {
	...WITH_PROGRAM,
	program: { ...ROTATE_PROGRAM, mode: 'SINGLE' },
}

const ONBOARDING_ANSWERS =
	'place GYM; usually STRENGTH_AND_CARDIO; level EXPERIENCED; 3 per week; equipment FULL_GYM, PULL_UP_BAR'

const BENCH_EXERCISE: ExerciseContext = {
	ref: 'x1',
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	last: { date: '2026-10-07', sets: sets(3, 8, 60), durationMin: null, distanceKm: null },
}

/** w1: a gym session with the bench press; `time` and `lastAt` set how old it is at 19:30. */
const gymSession = (time: string, lastAt: string): Partial<FoodParseContext> => {
	const workout: TodayWorkoutContext = {
		ref: 'w1',
		place: 'GYM',
		time,
		lastAt,
		finished: false,
		durationMin: null,
		kcalBurned: null,
		exercises: [
			{
				name: BENCH_EXERCISE.name,
				exerciseRef: BENCH_EXERCISE.ref,
				muscleGroup: 'CHEST',
				sets: sets(3, 8, 60),
				durationMin: null,
				distanceKm: null,
			},
		],
	}
	return { ...EVENING, workouts: [workout], exercises: [BENCH_EXERCISE] }
}

const KEPT_AS_IS = { keepsRefs: true, templateCount: { min: 2, max: 2 } } as const

/** An exercise of a fresh proposal: no history, so no x-ref and no weight. */
const proposed = (name: string, repsMin: number, repsMax: number): ProgramExerciseContext => ({
	name,
	exerciseRef: null,
	sets: PLAN_SETS,
	repsMin,
	repsMax,
	weightKg: null,
	durationMin: null,
	distanceKm: null,
})

const PENDING_A_EXERCISES = 3

/** The open card of a first program (no active one yet): А and Б, Б with the leg press. */
const PENDING_PROPOSAL: ProgramProposalContext = {
	mode: 'ROTATE',
	perWeek: 2,
	title: null,
	templates: [
		{
			ref: 't1',
			name: 'Тренування А',
			weekdays: [],
			exercises: [
				proposed('Жим лежачи', 8, 12),
				proposed('Тяга верхнього блоку', 10, 12),
				proposed('Жим гантелей сидячи', 10, 12),
			],
		},
		{
			ref: 't2',
			name: 'Тренування Б',
			weekdays: [],
			exercises: [
				proposed('Жим ногами', 10, 12),
				proposed('Румунська тяга', 10, 12),
				proposed('Тяга горизонтального блоку', 10, 12),
			],
		},
	],
}

export const PROGRAM_CASES: EvalCase[] = [
	{
		id: 'program-propose',
		text: 'Готово',
		context: { ...EVENING, programOnboarding: ONBOARDING_ANSWERS },
		expect: {
			decision: 'program',
			program: {
				mode: ['ROTATE', 'WEEKDAYS'],
				templateCount: { min: 2, max: 3 },
				exerciseCount: { min: 3, max: MAX_TEMPLATE_EXERCISES },
				noInventedWeights: true,
			},
		},
		reference:
			'Last onboarding step (gym, strength + cardio, experienced, 3 a week, full gym + pull-up bar): 2–3 templates of ≥ 3 exercises, no history → no weights',
	},
	{
		id: 'program-swap-leg-press',
		text: 'заміни жим ногами на присідання',
		context: WITH_PROGRAM,
		expect: {
			decision: 'program',
			program: {
				...KEPT_AS_IS,
				mode: 'ROTATE',
				templates: [
					{ nameIncludes: 'тренування а', exerciseCount: { min: 4, max: 4 } },
					{
						nameIncludes: 'тренування б',
						exerciseCount: { min: 4, max: 4 },
						exercises: [{ nameIncludes: 'присід' }, { nameIncludes: 'жим ногами', absent: true }],
					},
				],
			},
		},
		reference:
			'A change in words → the whole program again: both templates under their t-refs, Б with a squat instead of the leg press, А untouched',
	},
	{
		id: 'program-edit-pending',
		text: 'заміни жим ногами на присідання',
		context: { ...EVENING, pendingProgram: PENDING_PROPOSAL },
		expect: {
			decision: 'program',
			program: {
				...KEPT_AS_IS,
				mode: 'ROTATE',
				templates: [
					{
						nameIncludes: 'тренування а',
						exerciseCount: { min: PENDING_A_EXERCISES, max: PENDING_A_EXERCISES },
					},
					{
						nameIncludes: 'тренування б',
						exercises: [{ nameIncludes: 'присід' }, { nameIncludes: 'жим ногами', absent: true }],
					},
				],
			},
		},
		reference:
			'No program yet, a card not accepted: the change is built on the proposal — t1 and t2 kept, Б with a squat instead of the leg press, А untouched',
	},
	{
		id: 'program-newbie-home',
		text: 'я новачок, тренуюсь вдома, є гантелі, 3 рази на тиждень, склади програму',
		expect: {
			decision: 'program',
			program: {
				templateCount: { min: 2, max: 3 },
				exerciseCount: { min: 3, max: MAX_TEMPLATE_EXERCISES },
				noInventedWeights: true,
			},
		},
		reference:
			'A beginner at home with dumbbells, no history: simple strength moves, weightKg null everywhere',
	},
	{
		id: 'program-remove',
		text: 'прибери програму',
		context: WITH_PROGRAM,
		expect: { decision: 'reply', workouts: [] },
		reference:
			'The model cannot remove a program (only «Прибрати програму» on its screen): a reply, no propose_program, no log_workout',
	},
	{
		id: 'program-always-a',
		text: 'завжди А',
		context: WITH_PROGRAM,
		expect: {
			decision: 'program',
			program: {
				...KEPT_AS_IS,
				mode: 'SINGLE',
				pinnedRefOf: 'Тренування А',
				templates: [{ nameIncludes: 'тренування а' }, { nameIncludes: 'тренування б' }],
			},
		},
		reference: '«Завжди А» → mode SINGLE with pinnedRef t1; Б stays in the program',
	},
	{
		id: 'program-log-bound',
		text: 'зробив Б: жим ногами 120×10 ×3, тяга горизонтального блоку 50×12 ×3, румунська тяга 60×10 ×3, згинання ніг лежачи 35×12 ×3',
		context: WITH_PROGRAM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					templateRef: 't2',
					replaceRef: null,
					appendRef: null,
					exercises: [
						{ nameIncludes: 'жим ногами', sets: 3, reps: 10, weightKg: 120, exerciseRef: 'x5' },
						{ nameIncludes: 'горизонтального', sets: 3, reps: 12, weightKg: 50, exerciseRef: 'x6' },
						{ nameIncludes: 'румунськ', sets: 3, reps: 10, weightKg: 60, exerciseRef: 'x7' },
						{ nameIncludes: 'згинання', sets: 3, reps: 12, weightKg: 35, exerciseRef: 'x8' },
					],
				},
			],
		},
		reference: 'Template named and the same four exercises → templateRef t2 (the ref of Б)',
	},
	{
		id: 'program-log-unbound',
		text: 'зробив жим лежачи 60×8 ×3, присід 80×8 ×3, тягу верхнього блоку 50×12 ×3',
		context: WITH_PROGRAM,
		expect: {
			decision: 'workout',
			workouts: [
				{
					templateRef: null,
					replaceRef: null,
					appendRef: null,
					exercises: [
						{ nameIncludes: 'жим лежачи', sets: 3, reps: 8, weightKg: 60 },
						{ nameIncludes: 'присід', sets: 3, reps: 8, weightKg: 80 },
						{ nameIncludes: 'тяг', sets: 3, reps: 12, weightKg: 50 },
					],
				},
			],
		},
		reference:
			'A mix of exercises of А and others, no template named: merely similar → templateRef null',
	},
	{
		id: 'program-discuss',
		text: 'як думаєш, краще 2 чи 3 рази на тиждень?',
		context: WITH_PROGRAM,
		expect: { decision: 'reply', workouts: [] },
		reference: 'A question about the program: answer in words, propose_program only on request',
	},
	{
		id: 'e2-bodyweight-no-weight',
		text: 'підтягування 3×8',
		context: EVENING,
		expect: {
			decision: 'workout',
			workouts: [
				{
					replaceRef: null,
					appendRef: null,
					exercises: [{ nameIncludes: 'підтяг', sets: 3, reps: 8, weightKg: null }],
				},
			],
		},
		reference: 'Body weight: sets and reps, no weightKg (E2 shortened the field description)',
	},
	{
		id: 'e2-two-more-sets',
		text: 'ще 2 підходи',
		context: gymSession('18:50', '19:10'),
		expect: {
			decision: 'workout',
			workouts: [
				{
					appendRef: 'w1',
					replaceRef: null,
					exercises: [{ nameIncludes: 'жим лежачи', sets: 2, exerciseRef: 'x1' }],
				},
			],
		},
		reference:
			'«ще 2 підходи» without «додай» into a session open 40 min at the gym → appendRef w1 (E2)',
	},
	{
		id: 'e2-two-more-sets-late',
		text: 'ще 2 підходи',
		context: gymSession('14:50', '15:30'),
		expect: { decision: 'workout_or_reply', noAppend: true },
		reference:
			'The same words 4 h after the last entry (> 3 h): a new workout or a question, never appendRef (E2)',
	},
	{
		id: 'e2-clarify-and-estimate',
		text: '100 г гречки',
		expect: {
			decision: 'clarify',
			kcal: range(92, 132),
			categories: ['porridge'],
			clarifyAbout: ['гречк'],
		},
		reference:
			'Cooked ~110 vs dry ~343 kcal: log_food with the cooked estimate AND clarify in one answer (E2 shortened the clarify description)',
	},
]
