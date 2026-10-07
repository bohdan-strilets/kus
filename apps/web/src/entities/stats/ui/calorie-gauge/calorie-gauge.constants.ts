/**
 * Half-circle geometry from the mockups: compact — the chat header (112×70, r46, stroke 11),
 * large — «Сьогодні» (170×96, r73, stroke 14). The over arc sits on a white underlay 4px wider.
 */
export const GAUGE_GEOMETRY = {
	compact: {
		width: 112,
		height: 70,
		frameClass: 'h-17.5 w-28',
		path: 'M10 62 A46 46 0 0 1 102 62',
		stroke: 11,
	},
	large: {
		width: 170,
		height: 96,
		frameClass: 'h-24 w-42.5',
		path: 'M12 88 A73 73 0 0 1 158 88',
		stroke: 14,
	},
} as const

export const OVER_UNDERLAY_EXTRA = 4

export type GaugeSize = keyof typeof GAUGE_GEOMETRY
