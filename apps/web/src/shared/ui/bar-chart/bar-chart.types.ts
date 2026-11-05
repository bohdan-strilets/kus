export interface BarChartBar {
	/** Caption under the bar. */
	label: string
	value: number
	/** Value text above the bar; defaults to the number. */
	valueLabel?: string
	/** Spoken form of the bar, used in the hidden list when the chart has no `summary`. */
	ariaLabel?: string
	/** Not yet happened (a future day): no stub, no value, only the caption; left out of the hidden list. */
	isPending?: boolean
}

export interface BarChartProps {
	bars: readonly BarChartBar[]
	/** One-sentence description of the whole chart (translated by the caller): the chart becomes an image. */
	summary?: string
	/** Without `summary` the bars are read from a visually hidden list; the list needs a name. */
	listLabel?: string
	tone?: 'training' | 'cardio' | 'success'
	/** Show the value above each bar. */
	hasValues?: boolean
	className?: string
}
