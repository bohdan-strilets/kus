import { BRAND_ICON_SIZE } from './brand-icons.constants'
import type { BrandIconProps } from './brand-icons.types'

// Composer icons, path for path from design/mockups/chat.html and chat-voice.html.
// The mockup strokes are muted-strong (camera, mic) and white (send): set them with currentColor.

const STROKE_PROPS = {
	fill: 'none',
	stroke: 'currentColor',
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
} as const

export const CameraIcon = ({ size = BRAND_ICON_SIZE.composer, className }: BrandIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		strokeWidth="1.9"
		aria-hidden="true"
		className={className}
		{...STROKE_PROPS}
	>
		<path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
		<circle cx="12" cy="12.5" r="3.5" />
	</svg>
)

export const MicIcon = ({ size = BRAND_ICON_SIZE.composer, className }: BrandIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		strokeWidth="1.9"
		aria-hidden="true"
		className={className}
		{...STROKE_PROPS}
	>
		<rect x="9" y="3" width="6" height="11" rx="3" />
		<path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
	</svg>
)

export const SendIcon = ({ size = BRAND_ICON_SIZE.send, className }: BrandIconProps) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		strokeWidth="2.2"
		aria-hidden="true"
		className={className}
		{...STROKE_PROPS}
	>
		<path d="M12 19V5M5 12l7-7 7 7" />
	</svg>
)
