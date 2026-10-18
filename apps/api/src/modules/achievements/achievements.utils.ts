import { addDays, formatDbDate } from '../../common/time'
import { MAX_ACHIEVEMENT_STEP_KG, TENTHS_PER_KG } from './achievements.constants'

/**
 * Days in a row with food, counting back from `today`. A today without entries is a streak of 0:
 * the check runs in the turn that just logged (or restored) food, so a gap here is real.
 */
export const getFoodStreak = ({
	loggedDays,
	today,
	maxDays,
}: {
	loggedDays: ReadonlySet<string>
	today: Date
	maxDays: number
}): number => {
	let streak = 0
	while (streak < maxDays && loggedDays.has(formatDbDate(addDays(today, -streak)))) streak += 1
	return streak
}

/**
 * Whole kg lost since the start. Both weights have one decimal, so the difference is taken in
 * tenths (84.0 → 83.0 is 10, never 0.9999…) and floored: 83.1 after 84.0 is still 0 kg.
 */
export const getWholeKgLost = ({
	startKg,
	currentKg,
}: {
	startKg: number
	currentKg: number
}): number => {
	const lostTenths = Math.round(startKg * TENTHS_PER_KG) - Math.round(currentKg * TENTHS_PER_KG)
	return Math.max(0, Math.floor(lostTenths / TENTHS_PER_KG))
}

/** Strictly more than `MAX_ACHIEVEMENT_STEP_KG` between two weights, compared in whole tenths. */
export const isBigWeightStep = ({
	previousKg,
	currentKg,
}: {
	previousKg: number
	currentKg: number
}): boolean =>
	Math.abs(Math.round(currentKg * TENTHS_PER_KG) - Math.round(previousKg * TENTHS_PER_KG)) >
	MAX_ACHIEVEMENT_STEP_KG * TENTHS_PER_KG

/**
 * The weight kg lost is counted from: the last one before the latest big step in the chain
 * (base first, current last). A correction in the profile looks just like a loss, so a jump of
 * more than 3 kg is never paid out; corrections up to 3 kg are paid as a loss, as in the chat.
 * Null when there is nothing to pay: a single weight, or the last step itself is big.
 */
export const getKgLostBaseline = ({ chainKg }: { chainKg: number[] }): number | null => {
	if (chainKg.length < 2) return null
	let baseKg = chainKg[0]
	let previousKg = chainKg[0]
	chainKg.forEach((currentKg, index) => {
		if (index === 0 || previousKg === undefined) return
		const isLast = index === chainKg.length - 1
		const isBig = isBigWeightStep({ previousKg, currentKg })
		if (isLast && isBig) baseKg = undefined
		else if (isBig) baseKg = currentKg
		previousKg = currentKg
	})
	return baseKg ?? null
}

/** The whole-kg thresholds crossed between `from` kg lost (excluded) and `to` kg lost (included). */
export const getKgThresholds = ({ from, to }: { from: number; to: number }): number[] =>
	Array.from({ length: Math.max(0, to - from) }, (_, index) => from + index + 1)
