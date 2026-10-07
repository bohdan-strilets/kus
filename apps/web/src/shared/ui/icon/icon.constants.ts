/** Icon grid side (viewBox 0 0 24 24) and the default size. */
export const ICON_GRID = 24

/**
 * The line keeps ~1.75px on screen at any size (as in the mockups: 22px → 1.9, 18px → 2.3),
 * clamped so tiny and huge icons still look like the pack.
 */
export const ICON_STROKE = { opticalPx: 1.75, min: 1.6, max: 2.4 } as const

/** Sizes from design/CLAUDE-design.md rule 6: 18 in buttons and fields, 22 in the bottom nav. */
export const ICON_SIZE = { control: 18, nav: 22 } as const
