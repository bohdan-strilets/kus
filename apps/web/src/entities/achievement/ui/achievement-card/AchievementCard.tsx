import type { AchievementResponse } from '@kus/shared'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { achievementPopVariants, burst, CELEBRATE, isReducedMotion, useCountUp } from '@/shared/lib'
import { Hamster, Surface, Text } from '@/shared/ui'

import {
	ACHIEVEMENT_COUNT_UP_MS,
	ACHIEVEMENT_HAMSTER_SIZE,
	ACHIEVEMENT_TEXT_KEY,
} from './achievement-card.constants'

export interface AchievementCardProps {
	achievement: AchievementResponse
	/**
	 * The reply just arrived: the card pops, the number counts up and the confetti falls. A card
	 * from the history or after a reload is static and shows the final number at once.
	 */
	isFresh?: boolean
	/** The entrance is over (or skipped): the card is no longer «fresh». */
	onEntered?: () => void
}

/**
 * Level 3 celebration (design/docs/motion.md): «Серія днів / мінус кілограм». The sound and the
 * vibration belong to the reply (deliverMessage), the card brings the pop, the count and the
 * confetti. Reduced motion: no pop, no particles, the number is final at once.
 */
export const AchievementCard = ({
	achievement,
	isFresh = false,
	onEntered,
}: AchievementCardProps) => {
	const { t } = useTranslation()
	const { type, value } = achievement
	const hostRef = useRef<HTMLDivElement>(null)
	const originRef = useRef<HTMLDivElement>(null)
	const hasBurst = useRef(false)
	// fixed at mount, like `isFresh`: a re-render never restarts the entrance
	const [isPopping] = useState(() => isFresh && !isReducedMotion())

	const formatText = useCallback(
		(shown: number): string =>
			t(ACHIEVEMENT_TEXT_KEY[type], { count: value, value: Math.round(shown) }),
		[t, type, value],
	)
	const startValue = isFresh ? value - 1 : value
	const valueRef = useCountUp<HTMLSpanElement>(value, {
		initial: startValue,
		format: formatText,
		durationMs: ACHIEVEMENT_COUNT_UP_MS,
	})

	// without a pop there is no animation to end: the entrance is over at once
	useEffect(() => {
		if (isFresh && !isPopping) onEntered?.()
	}, [isFresh, isPopping, onEntered])

	const handlePopped = () => {
		if (!isPopping || hasBurst.current) return
		hasBurst.current = true
		if (hostRef.current && originRef.current)
			burst(hostRef.current, originRef.current, CELEBRATE.achieve)
		onEntered?.()
	}

	return (
		<motion.div
			variants={achievementPopVariants}
			initial={isPopping ? 'hidden' : false}
			animate="visible"
			onAnimationComplete={handlePopped}
		>
			<div ref={hostRef} className="relative">
				<Surface role="status" radius="card" className="flex items-center gap-3 p-3.5">
					<div ref={originRef} className="shrink-0">
						<Hamster mood="proud" size={ACHIEVEMENT_HAMSTER_SIZE} isBlinking={false} />
					</div>
					<div className="flex min-w-0 flex-col gap-0.5">
						<Text as="span" variant="eyebrow" tone="muted">
							{t('achievement.title')}
						</Text>
						{/* the counting text is hidden from screen readers: they get the final sentence once */}
						<Text as="span" variant="stat" aria-hidden="true">
							<span ref={valueRef}>{formatText(startValue)}</span>
						</Text>
						<span className="sr-only">{formatText(value)}</span>
					</div>
				</Surface>
			</div>
		</motion.div>
	)
}
