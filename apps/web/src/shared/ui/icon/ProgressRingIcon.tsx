import { cn } from '@/shared/lib'

import { ICON_GRID, ICON_SIZE, ICON_STROKE } from './icon.constants'

// Inactive: a track with the same optical weight as the other tabs' outlines, progress — a thicker
// arc on top. Active: a solid disc (like chat-filled), progress — a cream cut-out ring inside.
// Over the goal: a second lap inside (inactive) / a cream dot in the centre (active), growing up
// to +50 %, then it stays (design/src/icon/ProgressRingIcon.tsx).

const CUTOUT = 'var(--icon-cutout, #FFFFFF)'

const TRACK_RADIUS = 8.5
const PROGRESS_STROKE = 3.6
const SECOND_LAP_RADIUS = 4.6
const SECOND_LAP_STROKE = 2.6

const DISC_RADIUS = 9.6
const CUT_RADIUS = 5.6
const CUT_TRACK_STROKE = 1.6
const CUT_TRACK_OPACITY = 0.55
const CUT_PROGRESS_STROKE = 3
const OVER_DOT_MIN = 1.2
const OVER_DOT_GROWTH = 1.2
const MAX_OVER = 0.5

const getCircumference = (radius: number): number => 2 * Math.PI * radius

interface ArcProps {
	radius: number
	share: number
	strokeWidth: number
	color?: string
}

// From 12 o'clock, clockwise
const Arc = ({ radius, share, strokeWidth, color = 'currentColor' }: ArcProps) => {
	const length = getCircumference(radius)
	return (
		<circle
			cx="12"
			cy="12"
			r={radius}
			stroke={color}
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeDasharray={`${length * share} ${length}`}
			transform="rotate(-90 12 12)"
		/>
	)
}

export interface ProgressRingIconProps {
	/** Share of the day: eaten / goal. 0 — empty, 1 — goal, > 1 — over the goal. */
	progress: number
	/** The «Сьогодні» tab is active. */
	isActive?: boolean
	size?: number
	className?: string
}

/**
 * The «Сьогодні» tab icon. Colour is currentColor; the cut-out is var(--icon-cutout), white by
 * default like the dots in chat-filled.
 */
export const ProgressRingIcon = ({
	progress,
	isActive = false,
	size = ICON_SIZE.nav,
	className,
}: ProgressRingIconProps) => {
	const day = Math.min(1, Math.max(0, progress))
	const over = Math.min(MAX_OVER, Math.max(0, progress - 1))
	const trackStroke = (ICON_STROKE.opticalPx * ICON_GRID) / size

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className={cn('shrink-0', className)}
		>
			{isActive ? (
				<>
					<circle cx="12" cy="12" r={DISC_RADIUS} fill="currentColor" />
					<circle
						cx="12"
						cy="12"
						r={CUT_RADIUS}
						stroke={CUTOUT}
						strokeWidth={CUT_TRACK_STROKE}
						opacity={CUT_TRACK_OPACITY}
					/>
					{day > 0 && (
						<Arc radius={CUT_RADIUS} share={day} strokeWidth={CUT_PROGRESS_STROKE} color={CUTOUT} />
					)}
					{over > 0 && (
						<circle
							cx="12"
							cy="12"
							r={OVER_DOT_MIN + (OVER_DOT_GROWTH * over) / MAX_OVER}
							fill={CUTOUT}
						/>
					)}
				</>
			) : (
				<>
					<circle
						cx="12"
						cy="12"
						r={TRACK_RADIUS}
						stroke="currentColor"
						strokeWidth={trackStroke}
					/>
					{day > 0 && <Arc radius={TRACK_RADIUS} share={day} strokeWidth={PROGRESS_STROKE} />}
					{over > 0 && (
						<Arc radius={SECOND_LAP_RADIUS} share={over} strokeWidth={SECOND_LAP_STROKE} />
					)}
				</>
			)}
		</svg>
	)
}
