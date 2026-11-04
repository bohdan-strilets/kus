import { motion } from 'motion/react'
import { useRef, useState } from 'react'

import { cn, formatDecimal, PRESS } from '@/shared/lib'

import { Icon, ICON_SIZE } from '../icon'
import { parseStepperValue } from '../stepper/parse-stepper-value'
import { Text } from '../text'
import type { SetStepperProps } from './set-stepper.types'
import { StepValue } from './StepValue'

const BUTTON_CLASS =
	'flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-ink disabled:cursor-not-allowed disabled:opacity-50'
const VALUE_CLASS = 'text-achievement font-extrabold tabular-nums'

/**
 * mockups/training-live.html «Поточний підхід»: [−] 34/800 value [+] with 56px round buttons. A tap
 * on the value opens the system number keyboard in its place (Enter or leaving the field applies,
 * Escape or a bad value reverts) — the iOS keyboard brings its own «Готово».
 */
export const SetStepper = ({
	valueText,
	unit,
	value,
	placeholder,
	min,
	max,
	decimals,
	decreaseLabel,
	increaseLabel,
	editLabel,
	onDecrease,
	onIncrease,
	onCommit,
	isDecreaseDisabled = false,
	className,
}: SetStepperProps) => {
	const [isEditing, setIsEditing] = useState(false)
	const [draft, setDraft] = useState('')
	const [direction, setDirection] = useState<1 | -1>(1)
	// Enter applies and the unmounting input blurs: the second pass must do nothing
	const isDoneRef = useRef(false)

	const finish = (shouldApply: boolean): void => {
		if (isDoneRef.current) return
		isDoneRef.current = true
		setIsEditing(false)
		if (!shouldApply) return
		const next = parseStepperValue(draft, { min, max, decimals })
		if (next === null) return
		setDirection(1)
		onCommit(next)
	}

	const startEditing = (): void => {
		isDoneRef.current = false
		setDraft(value === null ? '' : formatDecimal(value, decimals).replace(/[,.]0+$/, ''))
		setIsEditing(true)
	}

	return (
		<div className={cn('flex items-center justify-between gap-2', className)}>
			<motion.button
				type="button"
				aria-label={decreaseLabel}
				disabled={isDecreaseDisabled}
				onClick={() => {
					setDirection(-1)
					onDecrease()
				}}
				{...(isDecreaseDisabled ? {} : PRESS)}
				className={BUTTON_CLASS}
			>
				<Icon name="minus" size={ICON_SIZE.control} />
			</motion.button>
			<span aria-live="polite" className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
				{isEditing ? (
					<input
						aria-label={editLabel}
						value={draft}
						placeholder={placeholder}
						inputMode={decimals > 0 ? 'decimal' : 'numeric'}
						enterKeyHint="done"
						autoFocus
						onFocus={(event) => {
							event.currentTarget.select()
						}}
						onChange={(event) => {
							setDraft(event.target.value)
						}}
						onBlur={() => {
							finish(true)
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter') finish(true)
							if (event.key === 'Escape') finish(false)
						}}
						className={cn(
							VALUE_CLASS,
							'min-h-14 w-full min-w-0 rounded-icon bg-surface text-center ring-2 ring-primary outline-none placeholder:text-card-title placeholder:font-semibold placeholder:text-muted',
						)}
					/>
				) : (
					<button
						type="button"
						aria-label={editLabel}
						onClick={startEditing}
						className={cn(VALUE_CLASS, 'min-h-14 min-w-14 cursor-pointer')}
					>
						<StepValue text={valueText} direction={direction} />
					</button>
				)}
				{!isEditing && (
					<Text as="span" variant="caption" tone="muted" weight="semibold">
						{unit}
					</Text>
				)}
			</span>
			<motion.button
				type="button"
				aria-label={increaseLabel}
				onClick={() => {
					setDirection(1)
					onIncrease()
				}}
				{...PRESS}
				className={BUTTON_CLASS}
			>
				<Icon name="plus" size={ICON_SIZE.control} />
			</motion.button>
		</div>
	)
}
