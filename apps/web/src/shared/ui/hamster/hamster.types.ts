import type { ReactNode } from 'react'

/** Full-body moods, see the table in design/docs/brand.md. */
export type HamsterMood =
	/** Привіт — first launch, morning */
	| 'wave'
	/** Радіє — day goal closed */
	| 'happy'
	/** Думає — clarifying a portion, Kusik is typing */
	| 'think'
	/** Записав — meal added (with a green check) */
	| 'logged'
	/** Підтримує — over goal, without reproach */
	| 'support'
	/** Здивований — «Ого, 900 ккал у салаті?» */
	| 'surprised'
	/** Ласує — favourite recipe */
	| 'yum'
	/** Голодний — meal reminder */
	| 'hungry'
	/** Гордий — streak, minus a kilogram */
	| 'proud'
	/** Нагадує — notification */
	| 'remind'
	/** Ой — error, offline */
	| 'oops'
	/** Вечір — day summary */
	| 'sleepy'

/** Chat avatar faces, picked by context (design/docs/components.md, Bubble — Kusik). */
export type HamsterHeadMood =
	'smile' | 'smileOpen' | 'happy' | 'think' | 'proud' | 'content' | 'oops' | 'hungry'

export interface HamsterProps {
	mood?: HamsterMood
	/** 140 empty states · 90 dialogs · 120 onboarding */
	size?: number
	/** Screen reader text via t(HAMSTER_LABEL_KEYS[mood]). Without it the hamster is decorative. */
	label?: string
	/** Blink every 4–6 s. Off under reduced motion. */
	isBlinking?: boolean
	className?: string
}

export interface HamsterHeadProps {
	mood?: HamsterHeadMood
	size?: number
	className?: string
}

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
