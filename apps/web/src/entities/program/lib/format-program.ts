import type { ExerciseKind, TemplateExerciseTarget } from '@kus/shared'
import type { TFunction } from 'i18next'

import {
	DETAIL_SEPARATOR,
	formatCardioSummary,
	formatNumber,
	formatWorkoutMinutes,
} from '@/entities/workout'
import { formatShortDate } from '@/shared/lib'

export interface ProgramTemplateMeta {
	/** Without cardio. */
	strengthCount: number
	hasCardio: boolean
	estimatedMin: number
}

/** A saved template (has `hasCardio`) or a draft on a proposal card (cardio is read from the exercises). */
export interface ProgramTemplateMetaSource {
	exercises: readonly { kind: ExerciseKind }[]
	hasCardio?: boolean
	estimatedMin: number
}

export const getProgramTemplateMeta = (
	template: ProgramTemplateMetaSource,
): ProgramTemplateMeta => ({
	strengthCount: template.exercises.filter((exercise) => exercise.kind !== 'CARDIO').length,
	hasCardio:
		template.hasCardio ?? template.exercises.some((exercise) => exercise.kind === 'CARDIO'),
	estimatedMin: template.estimatedMin,
})

/** «5 вправ + кардіо · ~55 хв»; the estimate only when there is one. */
export const formatProgramTemplateMeta = (
	template: ProgramTemplateMetaSource,
	t: TFunction,
): string => {
	const { strengthCount, hasCardio, estimatedMin } = getProgramTemplateMeta(template)
	const exercises = t('workout.exerciseCount', { count: strengthCount })
	const composition = !hasCardio
		? exercises
		: strengthCount === 0
			? t('workout.cardioBare')
			: t('program.meta.withCardio', { exercises })
	const parts = [
		composition,
		estimatedMin > 0
			? t('program.meta.duration', { duration: formatWorkoutMinutes(estimatedMin, t) })
			: null,
	].filter((part): part is string => part !== null)
	return parts.join(DETAIL_SEPARATOR)
}

/** «Версія від 31.10» in the local time of the phone. */
export const formatProgramVersionDate = (createdAt: string, t: TFunction): string =>
	t('program.versionFrom', { date: formatShortDate(new Date(createdAt)) })

const formatReps = ({ repsMin, repsMax }: TemplateExerciseTarget): string | null => {
	if (repsMin === null && repsMax === null) return null
	if (repsMin === null || repsMax === null || repsMin === repsMax) {
		return String(repsMin ?? repsMax)
	}
	return `${repsMin}–${repsMax}`
}

const formatSetsAndReps = (target: TemplateExerciseTarget, t: TFunction): string | null => {
	const reps = formatReps(target)
	if (target.sets !== null && reps !== null)
		return t('program.target.setsReps', { sets: target.sets, reps })
	if (target.sets !== null) return t('workout.setCount', { count: target.sets })
	return reps === null ? null : t('workout.reps', { value: reps })
}

/** «власна вага» for 0 kg, «60 кг» for a load, nothing when no weight is set. */
const formatTargetWeight = (weightKg: number | null, t: TFunction): string | null => {
	if (weightKg === null) return null
	if (weightKg === 0) return t('workout.bodyweight')
	return t('program.target.weight', { value: formatNumber(weightKg) })
}

/**
 * The plan of a strength exercise: «3 × 8–12 · 60 кг», «3 × 15–20 · власна вага», «4 × 12–15».
 * With `withDetails` the step and the rest follow: «… · +2,5 кг · 120 с» (the editor and the detail).
 */
export const formatStrengthTarget = (
	target: TemplateExerciseTarget,
	t: TFunction,
	{ withDetails = false }: { withDetails?: boolean } = {},
): string | null => {
	const parts = [formatSetsAndReps(target, t), formatTargetWeight(target.weightKg, t)]
	if (withDetails) {
		parts.push(
			target.progressStepKg === null
				? null
				: t('program.target.progressStep', { value: formatNumber(target.progressStepKg) }),
			target.restSec === null ? null : t('workout.sec', { value: target.restSec }),
		)
	}
	const line = parts.filter((part): part is string => part !== null)
	return line.length > 0 ? line.join(DETAIL_SEPARATOR) : null
}

/** «10 хв» or «10 хв · 3,0 км» for a cardio exercise. */
export const formatCardioTarget = (
	target: Pick<TemplateExerciseTarget, 'durationMin' | 'distanceM'>,
	t: TFunction,
): string | null => formatCardioSummary(target, t)

/** The right plan line by the kind of the exercise. */
export const formatProgramTarget = (
	exercise: { kind: ExerciseKind; target: TemplateExerciseTarget },
	t: TFunction,
	options: { withDetails?: boolean } = {},
): string | null =>
	exercise.kind === 'CARDIO'
		? formatCardioTarget(exercise.target, t)
		: formatStrengthTarget(exercise.target, t, options)
