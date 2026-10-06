const FULL_PERCENT = 100

/** value / max as a 0–100 bar width; over the max the bar is just full, a zero max is empty. */
export const getProgressPercent = (value: number, max: number): number => {
	if (max <= 0) return 0
	return Math.min(FULL_PERCENT, Math.max(0, (value / max) * FULL_PERCENT))
}
