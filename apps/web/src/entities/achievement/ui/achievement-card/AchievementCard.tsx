import type { AchievementResponse } from '@kus/shared'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { achievementPopVariants, burst, CELEBRATE, isReducedMotion, useCountUp } from '@/shared/lib'
import { Hamster, Surface, Text } from '@/shared/ui'

import { getAchievementPhrase } from '../../lib/get-achievement-phrase'
import {
	ACHIEVEMENT_CAPTION_KEY,
	ACHIEVEMENT_COUNT_UP_MS,
	ACHIEVEMENT_EYEBROW_KEY,
	ACHIEVEMENT_HAMSTER_SIZE,
	ACHIEVEMENT_NUMBER_KEY,
	ACHIEVEMENT_TEXT_KEY,
	ACHIEVEMENT_UNIT_KEY,
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
	const formatNumber = useCallback(
		(shown: number): string => t(ACHIEVEMENT_NUMBER_KEY[type], { value: Math.round(shown) }),
		[t, type],
	)
	const captionKey = ACHIEVEMENT_CAPTION_KEY[type]
	const phrase = getAchievementPhrase(achievement, t)
	const startValue = isFresh ? value - 1 : value
	const valueRef = useCountUp<HTMLSpanElement>(value, {
		initial: startValue,
		format: formatNumber,
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
				<Surface
					role="status"
					variant="achievement"
					shadow="achievement"
					className="flex flex-col gap-2.5 rounded-bl-tail p-4 ring-2 ring-decor-peach"
				>
					<div className="flex items-center gap-3">
						<div ref={originRef} className="shrink-0">
							<Hamster mood="happy" size={ACHIEVEMENT_HAMSTER_SIZE} isBlinking={false} />
						</div>
						<div className="flex min-w-0 flex-col gap-0.5">
							<Text as="span" variant="eyebrow" weight="extrabold" tone="primaryDeep">
								{t(ACHIEVEMENT_EYEBROW_KEY[type])}
							</Text>
							{/* the counting text is hidden from screen readers: they get the final sentence once */}
							<Text as="span" variant="achievement" aria-hidden="true">
								<span ref={valueRef}>{formatNumber(startValue)}</span>
								<Text as="span" variant="stat" weight="bold" tone="mutedStrong" className="ml-1">
									{t(ACHIEVEMENT_UNIT_KEY[type], { count: value })}
								</Text>
							</Text>
							<span className="sr-only">{formatText(value)}</span>
							{captionKey && (
								<Text as="span" variant="caption" weight="regular" tone="mutedStrong">
									{t(captionKey)}
								</Text>
							)}
						</div>
					</div>
					<Text variant="cardTitle" weight="regular" className="leading-snug">
						{phrase}
					</Text>
				</Surface>
			</div>
		</motion.div>
	)
}
