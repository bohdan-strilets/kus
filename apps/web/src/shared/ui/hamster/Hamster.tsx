import './hamster.css'

import { useRef } from 'react'

import { cn, useBlink, useSvgId } from '@/shared/lib'

import { Body, Cookie, CookieDefs, MoodBadge, PawLeft, PawWave } from './hamster-parts'
import { HAMSTER_MOODS } from './hamster.moods'
import type { HamsterProps } from './hamster.types'
import { useHopOnMoodChange } from './use-hop-on-mood-change'

/**
 * Kusik's mascot, full body with the cookie in its paws:
 *   <Hamster mood="happy" size={140} label={t(HAMSTER_LABEL_KEYS.happy)} />
 *   <Hamster mood="proud" badge={7} />  // number on the medal; without `badge` — a star
 * Without `label` it is decorative (when text next to it explains everything).
 * Artwork 1:1 with design/mockups/brand-hamster.html — no new moods without a mockup.
 *
 * An illustration (empty states, dialogs, onboarding). Its 12 moods are unrelated to the 8 chat
 * faces of HamsterHead: there is no mood → face mapping on purpose.
 */
export const Hamster = ({
	mood = 'wave',
	size = 120,
	label,
	badge,
	isBlinking = true,
	className,
}: HamsterProps) => {
	const ref = useRef<SVGSVGElement>(null)
	useBlink(ref, { isEnabled: isBlinking })
	useHopOnMoodChange(ref, mood)
	const gradientId = useSvgId('kg')
	const maskId = useSvgId('kb')
	const parts = HAMSTER_MOODS[mood]
	const isDecorative = !label

	return (
		<svg
			ref={ref}
			width={size}
			height={size}
			viewBox="0 0 120 120"
			className={cn('k-hamster', className)}
			data-mood={mood}
			role={isDecorative ? undefined : 'img'}
			aria-label={label}
			aria-hidden={isDecorative || undefined}
		>
			<CookieDefs gradientId={gradientId} maskId={maskId} />
			{parts.back}
			{parts.badge && <MoodBadge text={badge === undefined ? undefined : String(badge)} />}
			<Body />
			{parts.over}
			{!parts.isBare && <Cookie gradientId={gradientId} maskId={maskId} />}
			{!parts.isBare && (parts.paw === 'wave' ? <PawWave /> : <PawLeft />)}
			{parts.face}
			{parts.front}
		</svg>
	)
}
