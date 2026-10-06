import type { HamsterMood } from './hamster.types'

/**
 * The hamster is an illustration, so it has its own colours rather than UI tokens and does not
 * follow the theme (design/src/hamster/hamster.constants.ts, CLAUDE-design exception).
 */
export const HAMSTER_COLORS = {
	fur: '#F6B98A',
	furDark: '#E89A68',
	cheek: '#F9C7A0',
	belly: '#FFEBD8',
	earInner: '#F7B3A2',
	blush: '#F28E7A',
	nose: '#D96B5C',
	eye: '#2B1D14',
	brow: '#C97F52',
	whisker: '#D7A27C',
	accent: '#E58A45',
	accentLight: '#F2A877',
	bubble: '#F2B987',
	bell: '#F5C451',
	sweat: '#8FCBF2',
	moon: '#F8D9A8',
	success: '#17845A',
	white: '#FFFFFF',
	toothLine: '#E2CDBD',
	logoFrom: '#FFB877',
	logoTo: '#D45F22',
	logoLetter: '#FFF4E6',
} as const

/** i18n keys for screen reader labels: <Hamster label={t(HAMSTER_LABEL_KEYS[mood])} />. */
export const HAMSTER_LABEL_KEYS = {
	wave: 'hamster.mood.wave',
	happy: 'hamster.mood.happy',
	think: 'hamster.mood.think',
	logged: 'hamster.mood.logged',
	support: 'hamster.mood.support',
	surprised: 'hamster.mood.surprised',
	yum: 'hamster.mood.yum',
	hungry: 'hamster.mood.hungry',
	proud: 'hamster.mood.proud',
	remind: 'hamster.mood.remind',
	oops: 'hamster.mood.oops',
	sleepy: 'hamster.mood.sleepy',
} as const satisfies Record<HamsterMood, `hamster.mood.${HamsterMood}`>
