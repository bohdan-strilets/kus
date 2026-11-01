export interface SegmentedToggleOption<T extends string | number> {
	value: T
	label: string
	/** Spoken name when the visible label is not enough («30 днів» for «30 д»). */
	ariaLabel?: string
}

export interface SegmentedToggleProps<T extends string | number> {
	options: readonly SegmentedToggleOption<T>[]
	value: T
	onChange: (value: T) => void
	/** Name of the group (translated by the caller). */
	'aria-label': string
	/** `compact`: the Progress period pill (34px); `wide`: segments share the row (40px, training stats). */
	size?: 'compact' | 'wide'
	className?: string
}
