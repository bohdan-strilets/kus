/**
 * Positions 1:1 with the auth mockups (390 wide), on the Tailwind spacing scale (×4px).
 * Blobs: blur 24 (nearest to the mockups' 28). Colours only from decor tokens.
 */
export const DECOR_BLOBS = [
	'-left-22.5 -top-15 size-65 bg-decor-peach opacity-55',
	'left-55 top-140 size-70 bg-decor-mint opacity-50',
	'left-62.5 top-30 size-35 bg-primary-soft opacity-60',
] as const

/** Bitten cookies: the brand crumb shape (the mask bites the top-right edge). */
export const DECOR_CRUMBS = [
	'left-75 top-17.5 size-11.5 text-crumb opacity-35 -rotate-20',
	'left-6.5 top-175 size-8.5 text-over-soft opacity-28 rotate-35',
	'left-82.5 top-117.5 size-5.5 text-crumb opacity-30 rotate-80',
] as const

export const DECOR_RINGS = [
	'left-10 top-37.5 size-4.5 border-crumb opacity-35',
	'left-80 top-190 size-3.5 border-over-soft opacity-45',
] as const

export const DECOR_DOTS = [
	'left-17.5 top-150 size-2 bg-crumb opacity-35',
	'left-87.5 top-62.5 size-1.5 bg-over-soft opacity-50',
	'left-6 top-95 size-1.25 bg-crumb opacity-40',
] as const
