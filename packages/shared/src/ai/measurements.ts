// What the parser rejects in log_measurement. Shared, so the backend and the eval judge the same way.
import { MEASUREMENT_LIMITS } from '../schemas/measurements.js'
import type { LogMeasurementInput } from './tools.js'

/** A weight change bigger than this within the window needs the user's confirmation. */
export const WEIGHT_JUMP_KG = 3
export const WEIGHT_JUMP_WINDOW_DAYS = 7
export const MEASUREMENT_BACKDATE_MAX_DAYS = 7

const MS_IN_DAY = 24 * 60 * 60 * 1000
const TENTHS = 10

const UNITS = { WEIGHT: 'kg', WAIST: 'cm' } as const

/** A stored value as the model sees it in the context. */
export interface MeasurementPoint {
	value: number
	/** `YYYY-MM-DD` */
	localDate: string
}

export interface MeasurementRefs {
	/** The user's local day, `YYYY-MM-DD`. */
	today: string
}

/** The day a measurement belongs to. */
export const getMeasurementDay = ({ date }: LogMeasurementInput, today: string): string =>
	date ?? today

const getDayNumber = (date: string): number =>
	Math.round(Date.parse(`${date}T00:00:00Z`) / MS_IN_DAY)

/** Whole tenths, so 3.1 − 0.1 never turns into 2.9999999999999996. */
const toTenths = (value: number): number => Math.round(value * TENTHS)

const getRangeErrors = ({ kind, value }: LogMeasurementInput): string[] => {
	const { min, max } = MEASUREMENT_LIMITS[kind]
	if (value >= min && value <= max) return []
	return [
		`log_measurement: ${kind} ${value} is outside ${min}–${max} ${UNITS[kind]} — do not log; ask the user to check the number with reply`,
	]
}

const getDateErrors = ({ date }: LogMeasurementInput, today: string): string[] => {
	if (date === null) return []
	if (date > today) return [`log_measurement: date ${date} is in the future (today is ${today})`]
	if (getDayNumber(today) - getDayNumber(date) > MEASUREMENT_BACKDATE_MAX_DAYS) {
		return [
			`log_measurement: date ${date} is more than ${MEASUREMENT_BACKDATE_MAX_DAYS} days back — do not log; tell the user with reply that only the last ${MEASUREMENT_BACKDATE_MAX_DAYS} days can be added`,
		]
	}
	return []
}

/**
 * `previous` is the nearest weight of the user before the measurement's day, found by the caller
 * (a fix of the same day is compared with the day before, never with the value it replaces).
 */
export const getJumpErrors = (
	input: LogMeasurementInput,
	previous: MeasurementPoint | null,
	today: string,
): string[] => {
	const { kind, value, confirmedJump } = input
	if (kind !== 'WEIGHT' || confirmedJump || !previous) return []
	const day = getMeasurementDay(input, today)
	if (previous.localDate >= day) return []
	if (getDayNumber(day) - getDayNumber(previous.localDate) > WEIGHT_JUMP_WINDOW_DAYS) return []
	const delta = Math.abs(toTenths(value) - toTenths(previous.value))
	if (delta <= WEIGHT_JUMP_KG * TENTHS) return []
	return [
		`log_measurement: ${value} kg differs by ${(delta / TENTHS).toFixed(1)} kg from ${previous.value} on ${previous.localDate} — do not log; ask the user to confirm with reply`,
	]
}

const getDuplicateErrors = (inputs: readonly LogMeasurementInput[]): string[] =>
	(['WEIGHT', 'WAIST'] as const).flatMap((kind) =>
		inputs.filter((input) => input.kind === kind).length > 1
			? [`log_measurement: more than one ${kind} in a message — log one value per kind`]
			: [],
	)

export const getMeasurementErrors = (
	inputs: readonly LogMeasurementInput[],
	refs: MeasurementRefs,
): string[] => [
	...getDuplicateErrors(inputs),
	...inputs.flatMap((input) => [...getRangeErrors(input), ...getDateErrors(input, refs.today)]),
]
