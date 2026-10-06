import { BRAND_ICON_COLORS, BRAND_ICON_SIZE, PROGRESS_AREA_OPACITY } from './brand-icons.constants'
import type { NavIconProps } from './brand-icons.types'

// Bottom nav icons, path for path from design/mockups/{chat,today,progress,recipes}.html.
// Colour comes from currentColor: primary on the active tab, muted otherwise.

const STROKE_PROPS = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.9,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
} as const

const BUBBLE_PATH =
	'M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-7l-4.5 3.5v-3.5H6A2.5 2.5 0 0 1 3.5 15V7A2.5 2.5 0 0 1 6 4.5z'

export const NavChatIcon = ({
	size = BRAND_ICON_SIZE.nav,
	isActive = false,
	className,
}: NavIconProps) => {
	if (!isActive) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				aria-hidden="true"
				className={className}
				{...STROKE_PROPS}
			>
				<path d={BUBBLE_PATH} />
			</svg>
		)
	}

	return (
		<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
			<g fill="currentColor">
				<path d={BUBBLE_PATH} />
			</g>
			<circle cx="8.5" cy="11" r="1.2" fill={BRAND_ICON_COLORS.bubbleDots} />
			<circle cx="12" cy="11" r="1.2" fill={BRAND_ICON_COLORS.bubbleDots} />
			<circle cx="15.5" cy="11" r="1.2" fill={BRAND_ICON_COLORS.bubbleDots} />
		</svg>
	)
}

/** A small calorie ring: the same artwork on both states, only the track colour changes. */
export const NavTodayIcon = ({
	size = BRAND_ICON_SIZE.nav,
	isActive = false,
	className,
}: NavIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
		className={className}
	>
		<circle
			cx="12"
			cy="12"
			r="8"
			stroke={isActive ? BRAND_ICON_COLORS.ringTrackActive : BRAND_ICON_COLORS.ringTrack}
			strokeWidth="3"
		/>
		<circle
			cx="12"
			cy="12"
			r="8"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeDasharray="31.2 50.3"
			transform="rotate(-90 12 12)"
		/>
	</svg>
)

export const NavProgressIcon = ({
	size = BRAND_ICON_SIZE.nav,
	isActive = false,
	className,
}: NavIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		aria-hidden="true"
		className={className}
		{...STROKE_PROPS}
	>
		{isActive && (
			<path
				d="M5 15l4.5-4.5 3.5 3 6-6.5V19H5z"
				fill="currentColor"
				stroke="none"
				opacity={PROGRESS_AREA_OPACITY}
			/>
		)}
		<path d="M4 19.5h16" />
		<path d="M5 15l4.5-4.5 3.5 3 6-6.5" />
		<circle cx="19" cy="7" r="1.6" fill="currentColor" stroke="none" />
	</svg>
)

export const NavRecipesIcon = ({
	size = BRAND_ICON_SIZE.nav,
	isActive = false,
	className,
}: NavIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		aria-hidden="true"
		className={className}
		{...STROKE_PROPS}
	>
		<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" fill={isActive ? 'currentColor' : 'none'} />
		<path d="M9 3.5c-1 1.2 1 2 0 3.5M13.5 3.5c-1 1.2 1 2 0 3.5" />
	</svg>
)
