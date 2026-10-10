import { AnimatePresence, motion } from 'motion/react'
import { useId } from 'react'

import { cn, TRANSITION } from '@/shared/lib'

import type { FormFieldProps } from './form-field.types'
import { useShakeOnError } from './use-shake-on-error'

const ERROR_ENTER_OFFSET_PX = -4

/**
 * docs Field: a white card with the label inside on top, the control under it.
 * Focus — inset 2px primary ring; error — inset 2px danger, red label, a shake, then the
 * message under the card. Pair with React Hook Form via Controller (CLAUDE.md §7).
 */
export const FormField = ({
	label,
	error,
	hint,
	attemptCount = 0,
	endSlot,
	children,
	className,
}: FormFieldProps) => {
	const id = useId()
	const errorId = `${id}-error`
	const hintId = `${id}-hint`
	const hasError = Boolean(error)
	const describedBy = hasError ? errorId : hint ? hintId : undefined
	const cardRef = useShakeOnError(error, attemptCount)

	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<div
				ref={cardRef}
				className={cn(
					'flex items-center gap-2 rounded-field bg-surface px-3.5 py-2.5 shadow-field transition-shadow duration-(--duration-base)',
					hasError
						? // the red ring is always on, so focus needs its own sign (WCAG 2.4.7)
							'ring-2 ring-danger ring-inset focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink'
						: 'focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset',
				)}
			>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<label htmlFor={id} className={cn('text-small', hasError ? 'text-danger' : 'text-muted')}>
						{label}
					</label>
					{children({
						id,
						'aria-invalid': hasError,
						'aria-describedby': describedBy,
					})}
				</div>
				{endSlot}
			</div>
			<AnimatePresence initial={false}>
				{error && (
					// one stable key: a changed message updates in place, so the id is never duplicated
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
			{hint && !error && (
				<p id={hintId} className="text-small text-muted">
					{hint}
				</p>
			)}
		</div>
	)
}
