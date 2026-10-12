import { addDays, formatDbDate } from '../../common/time'
import { TENTHS_PER_KG } from './achievements.constants'

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

/** 1…count: every whole-kg threshold up to the current one. */
export const getKgThresholds = (count: number): number[] =>
	Array.from({ length: count }, (_, index) => index + 1)
