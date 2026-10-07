import { cn } from '@/shared/lib'

import { ICON_GRID, ICON_STROKE } from './icon.constants'
import { ICON_PATHS, type IconName } from './icon.generated'

export interface IconProps {
	name: IconName
	/** 18 — buttons and fields, 22 — bottom nav, 24 — default. */
	size?: number
	/** Only for an icon that stands alone; on an icon button put aria-label on the button. */
	label?: string
	className?: string
}

const getStrokeWidth = (size: number): number =>
	Math.min(ICON_STROKE.max, Math.max(ICON_STROKE.min, (ICON_STROKE.opticalPx * ICON_GRID) / size))

/**
 * The one UI icon (design/src/icon). Colour comes from the text: <Icon name="camera" className="text-muted" />.
 * Names are typed, so a missing icon fails typecheck; new ones go through the add-icon skill.
 */
export const Icon = ({ name, size = ICON_GRID, label, className }: IconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={getStrokeWidth(size)}
		strokeLinecap="round"
		strokeLinejoin="round"
		focusable="false"
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : true}
		className={cn('shrink-0', className)}
		data-icon={name}
	>
		{ICON_PATHS[name]}
	</svg>
)
