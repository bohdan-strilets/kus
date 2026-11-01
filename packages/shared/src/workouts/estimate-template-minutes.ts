import { DEFAULT_REST_SEC, type TemplateExerciseDraft } from '../schemas/programs.js'

export const WORK_SEC_PER_SET = 45
export const CHANGEOVER_SEC = 60
export const CARDIO_MIN_PER_KM = 6
export const ESTIMATE_ROUND_MIN = 5

const SEC_PER_MIN = 60
const M_PER_KM = 1000

const estimateStrengthSec = ({ target }: TemplateExerciseDraft): number => {
	const restSec = target.restSec ?? DEFAULT_REST_SEC
	const sets = target.sets ?? 0
	// no rest after the last set of an exercise
	const setsSec = sets > 0 ? sets * (WORK_SEC_PER_SET + restSec) - restSec : 0
	return setsSec + CHANGEOVER_SEC
}

const estimateCardioMin = ({ target }: TemplateExerciseDraft): number => {
	if (target.durationMin !== null) return target.durationMin
	if (target.distanceM !== null) return (target.distanceM / M_PER_KM) * CARDIO_MIN_PER_KM
	return 0
}

/** The «~55 хв» of a template: rounded to 5 minutes, never below 5. */
export const estimateTemplateMinutes = (exercises: readonly TemplateExerciseDraft[]): number => {
	const totalMin = exercises.reduce(
		(sum, exercise) =>
			exercise.kind === 'CARDIO'
				? sum + estimateCardioMin(exercise)
				: sum + estimateStrengthSec(exercise) / SEC_PER_MIN,
		0,
	)
	return Math.max(
		ESTIMATE_ROUND_MIN,
		Math.round(totalMin / ESTIMATE_ROUND_MIN) * ESTIMATE_ROUND_MIN,
	)
}
