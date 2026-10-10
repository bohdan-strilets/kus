import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'

import { cn, TRANSITION } from '@/shared/lib'

import { useShakeOnError } from '../form-field'
import type { NumberFieldProps } from './number-field.types'
import {
	numberFieldCardVariants,
	numberFieldInputVariants,
	numberFieldUnitVariants,
} from './number-field.variants'

const ERROR_ENTER_OFFSET_PX = -4

/**
 * docs NumberField: a label on top and a big number with its unit beside it (my-data-edit-sheet).
 * The `sm` size is the goal tile — the parent gives it a background through `className`.
 * The input is `type="text"` with `inputMode` so the decimal comma works on every keyboard.
 */
export const NumberField = ({
	label,
	unit,
	value,
	onChange,
	onBlur,
	inputMode,
	size = 'lg',
	error,
	attemptCount = 0,
	name,
	autoFocus,
	className,
}: NumberFieldProps) => {
	const id = useId()
	const errorId = `${id}-error`
	const hasError = Boolean(error)
	const cardRef = useShakeOnError(error, attemptCount)
	const isLarge = size === 'lg'

	return (
		<div className="flex flex-col gap-1.5">
			<div
				ref={cardRef}
				className={cn(
					numberFieldCardVariants({ size }),
					hasError && 'ring-2 ring-danger ring-inset',
					className,
				)}
			>
				<label
					htmlFor={id}
					className={cn(
						'text-small',
						hasError ? 'text-danger' : isLarge ? 'text-muted' : 'text-current',
					)}
				>
					{label}
				</label>
				<div className={cn('flex items-baseline', isLarge ? 'gap-1.5' : 'gap-1')}>
					<input
						id={id}
						name={name}
						type="text"
						inputMode={inputMode}
						autoComplete="off"
						enterKeyHint="done"
						autoFocus={autoFocus}
						value={value}
						onChange={(event) => {
							onChange(event.target.value)
						}}
						onBlur={onBlur}
						aria-invalid={hasError}
						aria-describedby={hasError ? errorId : undefined}
						className={numberFieldInputVariants({ size })}
					/>
					<span className={numberFieldUnitVariants({ size })}>{unit}</span>
				</div>
			</div>
			<AnimatePresence initial={false}>
				{error && (
					<motion.p
						key="error"
						id={errorId}
						role="alert"
						initial={{ opacity: 0, y: ERROR_ENTER_OFFSET_PX }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={TRANSITION.base}
						className="text-small text-danger"
					>
						{error}
					</motion.p>
				)}
			</AnimatePresence>
		</div>
	)
}
