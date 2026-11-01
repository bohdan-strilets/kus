import type { StepperValueLimits } from './parse-stepper-value'

/** Typing the value in: tap it, enter a number, Enter or blur applies, Escape or a bad value reverts. */
export interface StepperEdit extends StepperValueLimits {
	/** The text the input starts with: «2,5», empty when there is no value yet. */
	inputValue: string
	/** For the button that opens the input: «Підходи: 3, змінити». */
	buttonLabel: string
	onCommit: (value: number) => void
}

export interface StepperProps {
	/** The caption above: «Підходи». */
	label: string
	/** The value as it reads, already formatted: «3», «2,5», «—» when there is none. */
	valueText: string
	/** After the value, muted: «кг». */
	unit?: string
	/** For the − / + buttons: «Менше: Підходи». */
	decreaseLabel: string
	increaseLabel: string
	onDecrease: () => void
	onIncrease: () => void
	isDecreaseDisabled?: boolean
	isIncreaseDisabled?: boolean
	/** Without it the value is plain text. */
	edit?: StepperEdit
	className?: string
}
