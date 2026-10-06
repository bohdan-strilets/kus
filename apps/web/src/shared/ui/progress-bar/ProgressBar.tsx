import { motion, useReducedMotion } from 'motion/react'

import { BAR_DELAY_MS, BAR_FILL_MS, BAR_STEP_MS, cn, EASE, formatInteger } from '@/shared/lib'

import { getProgressPercent } from './get-progress-percent'
import {
	type ProgressFillVariantProps,
	progressFillVariants,
	type ProgressTrackVariantProps,
	progressTrackVariants,
} from './progress-bar.variants'

export type ProgressBarProps = ProgressTrackVariantProps &
	ProgressFillVariantProps & {
		value: number
		max: number
		/** Accessible name, e.g. «Білки». */
		label: string
		/** Position in a group: bars fill one after another, 80 ms apart (design/docs/motion.md). */
		index?: number
		className?: string
	}

const toSeconds = (ms: number): number => ms / 1000

export const ProgressBar = ({
	value,
	max,
	label,
	index = 0,
	track,
	tone,
	className,
}: ProgressBarProps) => {
	const shouldReduceMotion = useReducedMotion()
	const width = `${getProgressPercent(value, max)}%`

	return (
		<div
			role="progressbar"
			aria-label={label}
			// over the goal the bar is full; the value text still tells the real number
			aria-valuenow={Math.min(value, max)}
			aria-valuemin={0}
			aria-valuemax={max}
			aria-valuetext={`${formatInteger(value)} / ${formatInteger(max)}`}
			className={cn(progressTrackVariants({ track }), className)}
		>
			<motion.div
				className={progressFillVariants({ tone })}
				// width isn't a transform, so MotionConfig's reduced motion doesn't cover it
				initial={shouldReduceMotion ? false : { width: 0 }}
				animate={{ width }}
				transition={
					shouldReduceMotion
						? { duration: 0 }
						: {
								duration: toSeconds(BAR_FILL_MS),
								delay: toSeconds(BAR_DELAY_MS + index * BAR_STEP_MS),
								ease: EASE.out,
							}
				}
			/>
		</div>
	)
}
