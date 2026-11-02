import { normalizeExerciseName } from './exercise-name.js'

export const CARDIO_TYPES = [
	'RUN',
	'WALK',
	'BIKE',
	'ROW',
	'ELLIPTICAL',
	'STAIRS',
	'ROPE',
	'SWIM',
	'OTHER',
] as const

export type CardioType = (typeof CARDIO_TYPES)[number]

/** A treadmill at a lower speed is a walk, not a run. */
export const TREADMILL_WALK_MAX_KMH = 6.5

interface CardioTypeRule {
	readonly type: Exclude<CardioType, 'OTHER'>
	/** Alternatives; every stem of one alternative must start some word of the name. */
	readonly keywords: readonly (readonly string[])[]
}

/**
 * Ordered: the first matching rule wins. Stems are word prefixes, as in the muscle group rules;
 * the roots follow the cardio icon rules of the web app.
 */
const CARDIO_TYPE_RULES: readonly CardioTypeRule[] = [
	{ type: 'SWIM', keywords: [['плаван'], ['swim']] },
	{ type: 'ROPE', keywords: [['скакал'], ['jump', 'rope']] },
	{
		type: 'STAIRS',
		keywords: [['степер'], ['степпер'], ['stair'], ['сходи'], ['лестниц']],
	},
	{ type: 'ELLIPTICAL', keywords: [['еліпт'], ['эллипт'], ['ellipt']] },
	{ type: 'ROW', keywords: [['гребл'], ['гребн'], ['греб'], ['row']] },
	{ type: 'BIKE', keywords: [['вело'], ['bike'], ['cycl'], ['spin']] },
	{ type: 'WALK', keywords: [['ходьб'], ['walk']] },
	{
		type: 'RUN',
		keywords: [['біг'], ['бег'], ['run'], ['jog'], ['доріжк'], ['дорожк'], ['treadmill']],
	},
]

/** The words of the treadmill names: a run by default, a walk when the speed is known and low. */
const TREADMILL_STEMS: readonly string[] = ['доріжк', 'дорожк', 'treadmill']

const matchesStems = (words: readonly string[], stems: readonly string[]): boolean =>
	stems.every((stem) => words.some((word) => word.startsWith(stem)))

export interface CardioTypeOptions {
	/** Average speed in km/h when the distance and time are known. */
	speedKmh?: number | null
}

/** The kind of a cardio exercise by its name (and speed, for a treadmill); OTHER when unknown. */
export const getCardioType = (name: string, options: CardioTypeOptions = {}): CardioType => {
	const words = normalizeExerciseName(name).split(' ').filter(Boolean)
	const rule = CARDIO_TYPE_RULES.find(({ keywords }) =>
		keywords.some((stems) => matchesStems(words, stems)),
	)
	if (!rule) return 'OTHER'
	const { speedKmh = null } = options
	const isTreadmill = TREADMILL_STEMS.some((stem) => words.some((word) => word.startsWith(stem)))
	if (
		rule.type === 'RUN' &&
		isTreadmill &&
		speedKmh !== null &&
		speedKmh < TREADMILL_WALK_MAX_KMH
	) {
		return 'WALK'
	}
	return rule.type
}
