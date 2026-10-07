import { cn } from '@/shared/lib'

import { ICON_SIZE } from './icon.constants'

const RADIUS = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const RING_STROKE = 3
const TRACK_OPACITY = 0.3

export interface ProgressRingIconProps {
	/** Share of the day 0…1 (eaten / goal); above 1 draws a full ring, an empty day is 0. */
	progress: number
	size?: number
	className?: string
}

/**
 * The «Сьогодні» tab icon (design/src/icon): the ring fills with the day — 1 370 / 2 200 → 62 %
 * in the mockups. Ring and track are currentColor, the track at 30 %.
 */
export const ProgressRingIcon = ({
	progress,
	size = ICON_SIZE.nav,
	className,
}: ProgressRingIconProps) => {
	const clamped = Math.min(1, Math.max(0, progress))

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className={cn('shrink-0', className)}
		>
			<circle
				cx="12"
				cy="12"
				r={RADIUS}
				stroke="currentColor"
				strokeWidth={RING_STROKE}
				opacity={TRACK_OPACITY}
			/>
			{clamped > 0 && (
				<circle
					cx="12"
					cy="12"
					r={RADIUS}
					stroke="currentColor"
					strokeWidth={RING_STROKE}
					strokeLinecap="round"
					strokeDasharray={`${CIRCUMFERENCE * clamped} ${CIRCUMFERENCE}`}
					transform="rotate(-90 12 12)"
				/>
			)}
		</svg>
	)
}
