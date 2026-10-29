import type { IconName } from '@/shared/ui'

/** The icon of a cardio exercise by its name (the user's words): the machine or the sport. */
export const CARDIO_ICON_RULES: readonly { pattern: RegExp; icon: IconName }[] = [
	{ pattern: /біг|доріжк|run|treadmill/i, icon: 'run' },
	{ pattern: /вело|bike|cycl|spin/i, icon: 'bike' },
	{ pattern: /греб|row/i, icon: 'rowing' },
]

export const FALLBACK_CARDIO_ICON: IconName = 'cardio'
export const STRENGTH_ICON: IconName = 'training'

export const METERS_IN_KM = 1000
