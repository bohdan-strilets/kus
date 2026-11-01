/** A non-zero value never shrinks below this share of the tallest bar, so it stays visible. */
export const MIN_BAR_RATIO = 0.06

/**
 * Height of each bar as a share (0..1) of the tallest one. Zero (and negative or non-finite)
 * stays 0: the chart draws a stub for it, not a bar.
 */
export const getBarRatios = (values: readonly number[]): number[] => {
	const max = Math.max(0, ...values.filter(Number.isFinite))
	if (max === 0) return values.map(() => 0)
	return values.map((value) => {
		if (!Number.isFinite(value) || value <= 0) return 0
		return Math.max(value / max, MIN_BAR_RATIO)
	})
}
