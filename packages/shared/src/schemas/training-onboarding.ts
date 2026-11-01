import { z } from 'zod'

// The training onboarding is led by the backend: five questions with buttons, no model until the
// last answer. The values here are what is stored and sent; the web shows them through i18n.

export const trainingPlaceSchema = z.enum(['GYM', 'HOME', 'OUTDOOR', 'MIXED'])
export type TrainingPlace = z.infer<typeof trainingPlaceSchema>

export const trainingActivitySchema = z.enum([
	'STRENGTH',
	'CARDIO',
	'STRENGTH_AND_CARDIO',
	'NOTHING_YET',
])
export type TrainingActivity = z.infer<typeof trainingActivitySchema>

export const trainingLevelSchema = z.enum(['BEGINNER', 'EXPERIENCED', 'CONFIDENT'])
export type TrainingLevel = z.infer<typeof trainingLevelSchema>

export const trainingPerWeekSchema = z.enum(['2', '3', '4', '5+'])
export type TrainingPerWeek = z.infer<typeof trainingPerWeekSchema>

export const trainingEquipmentSchema = z.enum([
	'FULL_GYM',
	'DUMBBELLS',
	'PULL_UP_BAR',
	'BANDS',
	'NONE',
])
export type TrainingEquipment = z.infer<typeof trainingEquipmentSchema>

/** 0 = the invitation after the first workout, 1–5 = the questions. */
export const TRAINING_ONBOARDING_STEPS = [0, 1, 2, 3, 4, 5] as const
export const trainingOnboardingStepSchema = z.literal([...TRAINING_ONBOARDING_STEPS])
export type TrainingOnboardingStep = z.infer<typeof trainingOnboardingStepSchema>

export type TrainingOnboardingQuestionStep = Exclude<TrainingOnboardingStep, 0>

export const TRAINING_ONBOARDING_FIRST_QUESTION = 1 satisfies TrainingOnboardingQuestionStep
export const TRAINING_ONBOARDING_LAST_QUESTION = 5 satisfies TrainingOnboardingQuestionStep

/** The options of each question, in the order of the buttons. */
export const TRAINING_ONBOARDING_OPTIONS: Readonly<
	Record<TrainingOnboardingQuestionStep, readonly string[]>
> = {
	1: trainingPlaceSchema.options,
	2: trainingActivitySchema.options,
	3: trainingLevelSchema.options,
	4: trainingPerWeekSchema.options,
	5: trainingEquipmentSchema.options,
}

/** Only the equipment question takes several answers; «Нічого» excludes the rest. */
export const TRAINING_ONBOARDING_MULTI_STEP = 5 satisfies TrainingOnboardingQuestionStep
export const TRAINING_EQUIPMENT_NONE: TrainingEquipment = 'NONE'
/** «Зал» on the first question → «Повний зал» is already ticked in the equipment one. */
export const TRAINING_EQUIPMENT_FOR_GYM: TrainingEquipment = 'FULL_GYM'

export const TRAINING_ONBOARDING_ANSWER_INVALID = 'TRAINING_ONBOARDING_ANSWER_INVALID'

const ALL_OPTION_VALUES: ReadonlySet<string> = new Set(
	Object.values(TRAINING_ONBOARDING_OPTIONS).flat(),
)

export const isTrainingOnboardingQuestion = (
	step: TrainingOnboardingStep,
): step is TrainingOnboardingQuestionStep => step !== 0

/** Values of one answer: known for the step, no repeats, one value (1–5 on the equipment one), «Нічого» alone. */
export const isValidOnboardingAnswer = (
	step: TrainingOnboardingQuestionStep,
	values: readonly string[],
): boolean => {
	const options = TRAINING_ONBOARDING_OPTIONS[step]
	if (values.length === 0 || new Set(values).size !== values.length) return false
	if (!values.every((value) => options.includes(value))) return false
	if (step !== TRAINING_ONBOARDING_MULTI_STEP) return values.length === 1
	return !values.includes(TRAINING_EQUIPMENT_NONE) || values.length === 1
}

/** Kusik's onboarding message: the invitation (step 0) or a question with its answer once given. */
export const trainingOnboardingSchema = z
	.object({
		v: z.literal(1),
		step: trainingOnboardingStepSchema,
		/** Ticked before the user touches anything (the equipment question after «Зал»). */
		preselected: z.array(z.string()),
		/** The chosen values; null while not answered (always null on the invitation). */
		answer: z.array(z.string()).nullable(),
	})
	.refine(
		({ step, preselected }) =>
			isTrainingOnboardingQuestion(step)
				? preselected.every((value) => TRAINING_ONBOARDING_OPTIONS[step].includes(value))
				: preselected.length === 0,
		{ path: ['preselected'] },
	)
	.refine(
		({ step, answer }) =>
			answer === null ||
			(isTrainingOnboardingQuestion(step) && isValidOnboardingAnswer(step, answer)),
		{ path: ['answer'] },
	)
export type TrainingOnboarding = z.infer<typeof trainingOnboardingSchema>

/** Derived when the chat is read: ANSWERED has an answer, CLOSED was passed by (or the invitation declined). */
export const trainingOnboardingStateSchema = z.enum(['OPEN', 'ANSWERED', 'CLOSED'])
export type TrainingOnboardingState = z.infer<typeof trainingOnboardingStateSchema>

/**
 * POST /messages with the tap of a button (or «Готово»): the question message and the values. The
 * step is the server's to know, so here only «a known value, no repeats, «Нічого» alone».
 */
export const onboardingAnswerRequestSchema = z.object({
	messageId: z.uuid(),
	values: z
		.array(z.string().refine((value) => ALL_OPTION_VALUES.has(value)))
		.min(1)
		.max(trainingEquipmentSchema.options.length)
		.refine((values) => new Set(values).size === values.length, {
			message: TRAINING_ONBOARDING_ANSWER_INVALID,
		})
		.refine((values) => !values.includes(TRAINING_EQUIPMENT_NONE) || values.length === 1, {
			message: TRAINING_ONBOARDING_ANSWER_INVALID,
		}),
})
export type OnboardingAnswerRequest = z.infer<typeof onboardingAnswerRequestSchema>
