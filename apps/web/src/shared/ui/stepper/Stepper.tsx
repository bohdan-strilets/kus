import { motion } from 'motion/react'
import { useId } from 'react'

import { cn, PRESS } from '@/shared/lib'

import { Icon, ICON_SIZE } from '../icon'
import { Text } from '../text'
import type { StepperProps } from './stepper.types'
import { StepperValue } from './StepperValue'

const STEP_BUTTON_CLASS =
	'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-ink disabled:cursor-not-allowed disabled:opacity-50'

/**
 * A captioned − / value / + with 44px round buttons (training-program «Ціль вправи»). The value is a
 * live region, so a screen reader hears each step; with `edit` a tap on it opens a number input.
 */
export const Stepper = ({
	label,
	valueText,
	unit,
	decreaseLabel,
	increaseLabel,
	onDecrease,
	onIncrease,
	isDecreaseDisabled = false,
	isIncreaseDisabled = false,
	edit,
	className,
}: StepperProps) => {
	const labelId = useId()
	return (
		<div role="group" aria-labelledby={labelId} className={cn('flex flex-col gap-1', className)}>
			<Text as="span" id={labelId} variant="small" tone="muted" weight="semibold">
				{label}
			</Text>
			<div className="flex items-center gap-1.5">
				<motion.button
					type="button"
					aria-label={decreaseLabel}
					disabled={isDecreaseDisabled}
					onClick={onDecrease}
					{...(isDecreaseDisabled ? {} : PRESS)}
					className={STEP_BUTTON_CLASS}
				>
					<Icon name="minus" size={ICON_SIZE.control} />
				</motion.button>
				<StepperValue label={label} valueText={valueText} unit={unit} edit={edit} />
				<motion.button
					type="button"
					aria-label={increaseLabel}
					disabled={isIncreaseDisabled}
					onClick={onIncrease}
					{...(isIncreaseDisabled ? {} : PRESS)}
					className={STEP_BUTTON_CLASS}
				>
					<Icon name="plus" size={ICON_SIZE.control} />
				</motion.button>
			</div>
		</div>
	)
}
