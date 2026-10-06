import './hamster.css'

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, useBlink, useSvgId } from '@/shared/lib'

import { Body, Cookie, CookieDefs, PawLeft, PawWave } from './hamster-parts'
import { MOODS } from './hamster.moods'
import type { HamsterMood } from './hamster.types'

export interface HamsterProps {
	mood?: HamsterMood
	/** 140 empty states · 90 dialogs · 120 onboarding */
	size?: number
	/** Screen reader text; pass '' when the hamster is purely decorative. */
	label?: string
	/** Blink every 4–6 s. Off under reduced motion. */
	isBlinking?: boolean
	className?: string
}

/**
 * Kusik's mascot holding the logo cookie. Artwork 1:1 with design/mockups/brand-hamster.html —
 * don't redraw it or add moods without a mockup.
 */
export const Hamster = ({
	mood = 'wave',
	size = 120,
	label,
	isBlinking = true,
	className,
}: HamsterProps) => {
	const { t } = useTranslation()
	const ref = useRef<SVGSVGElement>(null)
	useBlink(ref, isBlinking)
	const gradientId = useSvgId('kg')
	const maskId = useSvgId('kb')
	const parts = MOODS[mood]
	const text = label ?? t(`hamster.mood.${mood}`)
	const isDecorative = text === ''

	return (
		<svg
			ref={ref}
			width={size}
			height={size}
			viewBox="0 0 120 120"
			className={cn('k-hamster', className)}
			data-mood={mood}
			role={isDecorative ? undefined : 'img'}
			aria-label={isDecorative ? undefined : text}
			aria-hidden={isDecorative || undefined}
		>
			<CookieDefs gradientId={gradientId} maskId={maskId} />
			{parts.back}
			<Body />
			{parts.over}
			<Cookie gradientId={gradientId} maskId={maskId} />
			{parts.paw === 'wave' ? <PawWave /> : <PawLeft />}
			{parts.face}
			{parts.front}
		</svg>
	)
}
