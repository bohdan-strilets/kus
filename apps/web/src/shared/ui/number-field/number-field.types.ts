export interface NumberFieldProps {
	label: string
	/** «кг», «ккал» — shown after the number. */
	unit: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	inputMode: 'decimal' | 'numeric'
	/** lg — the big number in an edit sheet; sm — a goal tile, whose background the parent sets. */
	size?: 'lg' | 'sm'
	/** Already translated; shown under the card, which shakes. */
	error?: string
	/** Submit attempts, so the card shakes again on every failed submit. */
	attemptCount?: number
	name?: string
	autoFocus?: boolean
	/** Background and text colours of the sm tile come from here. */
	className?: string
}
