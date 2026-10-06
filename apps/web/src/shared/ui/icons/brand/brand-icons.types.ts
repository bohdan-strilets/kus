export interface BrandIconProps {
	size?: number
	className?: string
}

export interface NavIconProps extends BrandIconProps {
	/** The active tab draws a filled variant (mockups chat, today, progress, recipes). */
	isActive?: boolean
}
