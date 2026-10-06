export type ParticleType = 'dot' | 'line' | 'ring' | 'bite' | 'star'

export interface BurstConfig {
	count: number
	types: readonly ParticleType[]
	/** Brand illustration colours (design/docs/motion.md), not UI tokens. */
	colors: readonly string[]
	distance: number
	durationMs: number
	/** Spread angle [from, to] in radians; without it particles fly in a full circle. */
	spread?: readonly [number, number]
	/** Fall in px (achievement confetti). */
	gravity?: number
}

const UPWARD_SPREAD: readonly [number, number] = [-Math.PI * 0.95, -Math.PI * 0.05]

/** Three success levels: the rarer the event, the brighter the effect (design/docs/motion.md). */
export const CELEBRATE = {
	/** 1 · «Кусь» — every logged meal: 4 crumbs upward, 450 ms. */
	kusik: {
		count: 4,
		types: ['dot', 'dot', 'bite', 'dot'],
		colors: ['#E58A45', '#F2A877', '#E58A45', '#F7C59A'],
		distance: 30,
		durationMs: 450,
		spread: UPWARD_SPREAD,
	},
	/** 2 · Day goal — once a day: 12 particles around the ring, 700 ms. */
	goal: {
		count: 12,
		types: ['dot', 'line', 'ring', 'line'],
		colors: ['#E58A45', '#F2A877', '#B9521A', '#F7C59A'],
		distance: 92,
		durationMs: 700,
	},
	/** 3 · Achievement — rare: 18 confetti of cookies and stars falling, 1000 ms. */
	achieve: {
		count: 18,
		types: ['bite', 'star', 'dot', 'star', 'dot', 'ring'],
		colors: ['#F2A877', '#E58A45', '#F5C451', '#B9521A', '#F7C59A'],
		distance: 120,
		durationMs: 1000,
		gravity: 60,
		spread: UPWARD_SPREAD,
	},
} as const satisfies Record<string, BurstConfig>

export type CelebrationLevel = keyof typeof CELEBRATE
