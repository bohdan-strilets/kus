import type { WorkoutExerciseResponse, WorkoutSetResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatInteger } from '@/shared/lib'

import { formatCardioSummary, formatNumber } from './format-workout'

export type SetSegmentKind = 'warmup' | 'work' | 'record'

export interface SetSegment {
	kind: SetSegmentKind
	/** «70 кг × 5», «8 повт.», «45 с», «15 хв · 2,1 км»; the number of sets is separate. */
	text: string
	/** «— 3 підходи»: only neighbouring equal sets are folded. */
	count?: number
}

export interface FormattedSets {
	segments: SetSegment[]
}

type SetsSource = Pick<
	WorkoutExerciseResponse,
	'kind' | 'sets' | 'record' | 'durationMin' | 'distanceM'
>

/** weightKg 0 means «no weight» for bodyweight sets, the same as null. */
const hasWeight = (set: WorkoutSetResponse): boolean => set.weightKg !== null && set.weightKg > 0

const formatSetText = (set: WorkoutSetResponse, t: TFunction): string | null => {
	if (set.reps === null) {
		return set.durationSec === null
			? null
			: t('workout.sec', { value: formatInteger(set.durationSec) })
	}
	const reps = formatInteger(set.reps)
	return set.weightKg !== null && hasWeight(set)
		? t('workout.setWeightReps', { weight: formatNumber(set.weightKg), reps })
		: t('workout.reps', { value: reps })
}

/** The working set that gave the record: the heaviest one, or the one with most reps without weight. */
const findRecordIndex = (
	sets: readonly WorkoutSetResponse[],
	record: SetsSource['record'],
): number => {
	if (record !== 'WEIGHT' && record !== 'REPS') return -1
	let bestIndex = -1
	let bestValue = -Infinity
	sets.forEach((set, index) => {
		if (set.isWarmup) return
		const isCandidate = record === 'WEIGHT' ? hasWeight(set) : !hasWeight(set)
		const value = record === 'WEIGHT' ? set.weightKg : set.reps
		if (!isCandidate || value === null || value <= bestValue) return
		bestIndex = index
		bestValue = value
	})
	return bestIndex
}

const foldNeighbours = (segments: readonly SetSegment[]): SetSegment[] =>
	segments.reduce<SetSegment[]>((folded, segment) => {
		const last = folded[folded.length - 1]
		const isSame =
			last !== undefined &&
			segment.kind !== 'record' &&
			last.kind === segment.kind &&
			last.text === segment.text
		if (isSame) {
			last.count = (last.count ?? 1) + 1
			return folded
		}
		folded.push({ ...segment })
		return folded
	}, [])

const formatStrengthSets = (exercise: SetsSource, t: TFunction): FormattedSets => {
	const recordIndex = findRecordIndex(exercise.sets, exercise.record)
	const warmups: SetSegment[] = []
	const works: SetSegment[] = []
	exercise.sets.forEach((set, index) => {
		const text = formatSetText(set, t)
		if (text === null) return
		if (set.isWarmup) {
			warmups.push({ kind: 'warmup', text })
			return
		}
		works.push({ kind: index === recordIndex ? 'record' : 'work', text })
	})
	return { segments: [...foldNeighbours(warmups), ...foldNeighbours(works)] }
}

/**
 * The sets of an exercise as segments of the notation (design/docs/training-groups.md): warm-ups
 * first, equal neighbours folded into «— 3 підходи», the record set apart; «70 кг × 5», a
 * bodyweight set is «8 повт.»; cardio is the one segment «15 хв · 2,1 км».
 */
export const formatSets = (exercise: SetsSource, t: TFunction): FormattedSets => {
	if (exercise.kind === 'CARDIO') {
		const text = formatCardioSummary(exercise, t)
		return { segments: text === null ? [] : [{ kind: 'work', text }] }
	}
	return formatStrengthSets(exercise, t)
}
