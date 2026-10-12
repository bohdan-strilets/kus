import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { burst, CELEBRATE, popInVariants, ROW_STAGGER_S, TRANSITION } from '@/shared/lib'
import { Badge } from '@/shared/ui'

import { BADGE_HOLD_MS } from './logged-badge.constants'

export interface LoggedBadgeProps {
	/** Position of the card in the reply: the pops cascade. */
	index: number
	/** Only one card of a reply throws the crumbs. */
	hasCrumbs: boolean
	/** The badge has faded out: the card is no longer «just logged». */
	onDone: () => void
}

type BadgePhase = 'wait' | 'pop' | 'hold' | 'fade'

const SECOND_MS = 1000

const getAnimate = (phase: BadgePhase) => {
	if (phase === 'wait') return 'hidden'
	if (phase === 'fade') return { opacity: 0, transition: TRANSITION.base }
	return 'visible'
}

/**
 * «Logged» mark in the top right corner of a fresh meal card: pops, throws crumbs, holds, fades out
 * and reports it is done. Place it inside the card's `relative` wrapper.
 */
export const LoggedBadge = ({ index, hasCrumbs, onDone }: LoggedBadgeProps) => {
	const { t } = useTranslation()
	const badgeRef = useRef<HTMLSpanElement>(null)
	const [phase, setPhase] = useState<BadgePhase>('wait')
	const [isGone, setIsGone] = useState(false)

	// wait (cascade delay) -> pop; hold -> fade. The pop and the fade end via onAnimationComplete.
	useEffect(() => {
		if (phase !== 'wait' && phase !== 'hold') return
		const delayMs = phase === 'wait' ? index * ROW_STAGGER_S * SECOND_MS : BADGE_HOLD_MS
		const timer = setTimeout(() => {
			setPhase(phase === 'wait' ? 'pop' : 'fade')
		}, delayMs)
		return () => {
			clearTimeout(timer)
		}
	}, [phase, index])

	if (isGone) return null

	const handleAnimationComplete = () => {
		if (phase === 'pop') {
			const badge = badgeRef.current
			// the card wrapper is the positioned ancestor the badge is placed against
			const host = badge?.offsetParent instanceof HTMLElement ? badge.offsetParent : null
			if (hasCrumbs && badge && host) burst(host, badge, CELEBRATE.kusik)
			setPhase('hold')
			return
		}
		if (phase === 'fade') {
			onDone()
			setIsGone(true)
		}
	}

	return (
		<motion.span
			ref={badgeRef}
			className="absolute -top-2.5 -right-2.5 z-10"
			variants={popInVariants}
			initial="hidden"
			animate={getAnimate(phase)}
			onAnimationComplete={handleAnimationComplete}
		>
			<Badge variant="success" label={t('entry.logged')} />
		</motion.span>
	)
}
