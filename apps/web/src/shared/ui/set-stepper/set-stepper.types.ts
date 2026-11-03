import type { StepperValueLimits } from '../stepper/parse-stepper-value'

export interface SetStepperProps extends StepperValueLimits {
	/** The value as it reads: «52,5»; «—» when there is none. */
	valueText: string
	/** After the value: «кг», «повт.». */
	unit: string
	/** The current number; null = no value yet (the input starts empty). */
	value: number | null
	/** Hint of the empty input: «Вага, кг». */
	placeholder: string
	/** Accessible names: «Менше ваги», «Більше ваги», «кг: ввести число». */
	decreaseLabel: string
	increaseLabel: string
	editLabel: string
	onDecrease: () => void
	onIncrease: () => void
	/** A typed number inside the limits. */
	onCommit: (value: number) => void
	isDecreaseDisabled?: boolean
	className?: string
}
