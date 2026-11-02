import {
	type CardioType,
	type ExerciseKind,
	type ExerciseSource,
	getCardioType,
	isBodyweightByName,
	isTreadmillName,
	type WorkoutKcal,
	type WorkoutKcalSource,
} from '@kus/shared'

import {
	BODYWEIGHT_STRENGTH_MET,
	DEFAULT_CARDIO_PACE_MIN_PER_KM,
	REST_MET,
	ROUND_KCAL_TO,
	STRENGTH_MET,
	STRENGTH_MIN_PER_SET,
} from './workout-kcal.constants'
import { getCardioMet } from './workout-kcal-met'

const MIN_PER_HOUR = 60
const SEC_PER_MIN = 60
const M_PER_KM = 1000

export interface KcalSet {
	isWarmup: boolean
	durationSec: number | null
	distanceM: number | null
}

export interface KcalEntry {
	name: string
	kind: ExerciseKind
	isBodyweight: boolean | null
	/** The dictionary row, when the entry still has one. */
	exercise?: { isBodyweight?: boolean | null } | null
	durationMin: number | null
	distanceM: number | null
	kcalBurned: number | null
	source: ExerciseSource
	sets: readonly KcalSet[]
}

export interface KcalWorkout {
	durationMin: number | null
	kcalBurned: number | null
	kcalSource: ExerciseSource | null
	exercises: readonly KcalEntry[]
}

interface KcalPart {
	kcal: number
	source: WorkoutKcalSource
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

const toNamedSource = (source: ExerciseSource | null): WorkoutKcalSource => {
	if (source === 'DEVICE') return 'DEVICE'
	// the prompt forbids the model to estimate burned kcal, so a named number is the user's word
	return source === 'AI_ESTIMATE' ? 'ESTIMATE' : 'MANUAL'
}

const getActiveKcal = (met: number, kg: number, hours: number): number =>
	(met - REST_MET) * kg * hours

const countWorkingSets = (entry: KcalEntry): number =>
	entry.sets.filter((set) => !set.isWarmup).length

/** The entry's own flag, then the dictionary's, then the name. */
const isBodyweightEntry = (entry: KcalEntry): boolean =>
	entry.isBodyweight ?? entry.exercise?.isBodyweight ?? isBodyweightByName(entry.name)

const getCardioDistanceM = (entry: KcalEntry): number | null => {
	if (entry.distanceM !== null) return entry.distanceM
	const setM = sum(entry.sets.map((set) => set.distanceM ?? 0))
	return setM > 0 ? setM : null
}

/** The time the person told: the entry's or the sum of its intervals; null when none. */
const getToldMinutes = (entry: KcalEntry): number | null => {
	if (entry.durationMin !== null) return entry.durationMin
	const setSec = sum(entry.sets.map((set) => set.durationSec ?? 0))
	return setSec > 0 ? setSec / SEC_PER_MIN : null
}

/** A time from the distance at a typical pace, for the kinds that have one. */
const getPaceMinutes = (type: CardioType, distanceM: number | null): number | null => {
	if (distanceM === null || !(type in DEFAULT_CARDIO_PACE_MIN_PER_KM)) return null
	const pace = DEFAULT_CARDIO_PACE_MIN_PER_KM[type as keyof typeof DEFAULT_CARDIO_PACE_MIN_PER_KM]
	return (distanceM / M_PER_KM) * pace
}

/** The kcal part of one cardio entry (null when its time is unknown) and the minutes it took. */
const getCardioPart = (
	entry: KcalEntry,
	kg: number | null,
): { part: KcalPart | null; minutes: number } => {
	const distanceM = getCardioDistanceM(entry)
	const toldMinutes = getToldMinutes(entry)
	// the speed is only known when both the time and the distance were told
	const speedKmh =
		toldMinutes !== null && toldMinutes > 0 && distanceM !== null
			? distanceM / M_PER_KM / (toldMinutes / MIN_PER_HOUR)
			: null
	const type = getCardioType(entry.name, { speedKmh })
	const minutes = toldMinutes ?? getPaceMinutes(type, distanceM) ?? 0
	if (entry.kcalBurned !== null) {
		const source: WorkoutKcalSource = entry.source === 'DEVICE' ? 'DEVICE' : 'MANUAL'
		return { part: { kcal: entry.kcalBurned, source }, minutes }
	}
	if (kg === null || minutes <= 0) return { part: null, minutes: 0 }
	const { met } = getCardioMet({ type, speedKmh, isTreadmill: isTreadmillName(entry.name) })
	return {
		part: { kcal: getActiveKcal(met, kg, minutes / MIN_PER_HOUR), source: 'ESTIMATE' },
		minutes,
	}
}

const getStrengthPart = (
	strength: readonly KcalEntry[],
	{ durationMin, cardioMin, kg }: { durationMin: number | null; cardioMin: number; kg: number },
): KcalPart | null => {
	if (strength.length === 0) return null
	const workingSets = sum(strength.map(countWorkingSets))
	const minutes =
		durationMin === null ? workingSets * STRENGTH_MIN_PER_SET : Math.max(0, durationMin - cardioMin)
	if (minutes <= 0) return null
	const met =
		workingSets === 0
			? STRENGTH_MET.met
			: sum(
					strength.map(
						(entry) =>
							countWorkingSets(entry) *
							(isBodyweightEntry(entry) ? BODYWEIGHT_STRENGTH_MET.met : STRENGTH_MET.met),
					),
				) / workingSets
	return { kcal: getActiveKcal(met, kg, minutes / MIN_PER_HOUR), source: 'ESTIMATE' }
}

const combineParts = (parts: readonly KcalPart[]): WorkoutKcal | null => {
	if (parts.length === 0) return null
	const total = sum(parts.map((part) => part.kcal))
	const isEstimate = parts.some((part) => part.source === 'ESTIMATE')
	if (isEstimate) {
		const value = Math.round(total / ROUND_KCAL_TO) * ROUND_KCAL_TO
		return value > 0 ? { value, source: 'ESTIMATE' } : null
	}
	const value = Math.round(total)
	if (value <= 0) return null
	return { value, source: parts.every((part) => part.source === 'DEVICE') ? 'DEVICE' : 'MANUAL' }
}

/**
 * The kcal a workout shows: what the user named or a device showed, else an estimate from the body
 * weight, (MET − 1) × kg × hours of the cardio and of the strength part. Never stored, never given
 * to the model.
 */
export const estimateWorkoutKcal = ({
	workout,
	bodyWeightKg,
}: {
	workout: KcalWorkout
	bodyWeightKg: number | null
}): WorkoutKcal | null => {
	if (workout.kcalBurned !== null) {
		return { value: workout.kcalBurned, source: toNamedSource(workout.kcalSource) }
	}
	// without a body weight only what the person named can be shown
	const kg = bodyWeightKg !== null && bodyWeightKg > 0 ? bodyWeightKg : null
	const cardio = workout.exercises
		.filter((entry) => entry.kind === 'CARDIO')
		.map((entry) => getCardioPart(entry, kg))
	const cardioMin = sum(cardio.map(({ minutes }) => minutes))
	const strengthPart =
		kg === null
			? null
			: getStrengthPart(
					workout.exercises.filter((entry) => entry.kind === 'STRENGTH'),
					{ durationMin: workout.durationMin, cardioMin, kg },
				)
	const parts = [...cardio.map(({ part }) => part), strengthPart].filter(
		(part): part is KcalPart => part !== null,
	)
	return combineParts(parts)
}
