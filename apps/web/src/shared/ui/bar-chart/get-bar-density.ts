/** Above this many bars the value captions above them are dropped: they would touch at 358 px. */
export const BAR_CHART_DENSE_THRESHOLD = 8

/** A dense chart captions at most this many columns, so the captions never meet. */
export const BAR_CHART_MAX_LABELS = 5

export interface BarDensity {
	isDense: boolean
	/** Every n-th column keeps its caption (the first one always does). */
	labelStep: number
}

export const getBarDensity = (barCount: number): BarDensity => {
	if (barCount <= BAR_CHART_DENSE_THRESHOLD) return { isDense: false, labelStep: 1 }
	return { isDense: true, labelStep: Math.ceil(barCount / BAR_CHART_MAX_LABELS) }
}
