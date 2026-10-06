import type { ReactNode } from 'react'

/** Full-body moods, see the table in design/docs/brand.md. */
export const HAMSTER_MOODS = [
	'wave',
	'happy',
	'think',
	'logged',
	'support',
	'surprised',
	'yum',
	'hungry',
	'proud',
	'remind',
	'oops',
	'sleepy',
] as const

export type HamsterMood = (typeof HAMSTER_MOODS)[number]

/** Chat avatar moods. */
export const HEAD_MOODS = ['smile', 'happy', 'think', 'proud'] as const

export type HeadMood = (typeof HEAD_MOODS)[number]

export interface MoodParts {
	/** Decor behind the hamster (stars, thought bubbles, moon). */
	back?: ReactNode
	/** Between the body and the cookie (full cheeks). */
	over?: ReactNode
	/** Left paw: resting or waving. */
	paw?: 'down' | 'wave'
	face: ReactNode
	/** Decor on top (green check). */
	front?: ReactNode
}
