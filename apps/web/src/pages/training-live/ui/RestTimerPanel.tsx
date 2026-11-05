import type { TFunction } from 'i18next'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import {
	formatRestSet,
	formatRestTime,
	type RestNext,
	type RestTimer,
} from '@/features/live-workout'
import { sheetReducedVariants, sheetVariants, useElementHeight } from '@/shared/lib'
import { Button, Heading, Text } from '@/shared/ui'

import { RestRing } from './RestRing'
import { WakeLockHint } from './WakeLockHint'

const ignoreHeight = (): void => undefined

interface RestTimerPanelProps {
	timer: RestTimer
	/** The height the panel takes over the content (0 when it is gone): the content keeps that much room. */
	onHeightChange?: (heightPx: number) => void
	/** Wake Lock is not available: while the timer runs the sheet says the screen may go dark. */
	isWakeLockUnavailable?: boolean
}

const getNextText = (next: RestNext | null, isEnded: boolean, t: TFunction): string | null => {
	if (next === null) return null
	const set = formatRestSet(next.set, t)
	const exercise = next.exercise.name
	if (next.isOtherExercise) {
		return next.isWarmup
			? t('training.live.rest.nextExerciseWarmup', { exercise, set })
			: t('training.live.rest.nextExercise', { exercise, set })
	}
	if (next.isWarmup)
		return isEnded
			? t('workout.warmupSet', { value: set })
			: t('training.live.rest.nextWarmup', { set })
	return isEnded ? set : t('training.live.rest.nextSet', { n: next.setNumber, set })
}

const getTitle = (next: RestNext | null, isEnded: boolean, t: TFunction): string => {
	if (!isEnded || next === null) return t('training.live.rest.title')
	return next.isWarmup
		? t('training.live.rest.overWarmup')
		: t('training.live.rest.over', { n: next.setNumber })
}

/**
 * mockups/training-rest.html: a sheet over the content, from the bottom, on `ink` — the ring, «Відпочинок» and what
 * comes next, [+15 с] [Пропустити]; at the end «Час! Підхід N» and one [До підходу]. The end is
 * announced to a screen reader (`aria-live="assertive"`). The «на паузі» state of the mockup is
 * not made: the time is counted from `doneAt`, so there is nothing to pause.
 */
export const RestTimerPanel = ({
	timer,
	onHeightChange,
	isWakeLockUnavailable = false,
}: RestTimerPanelProps) => {
	const { t } = useTranslation()
	const isReduced = useReducedMotion() === true
	const heightRef = useElementHeight(onHeightChange ?? ignoreHeight)
	const { state, next } = timer
	const isShown = state.status !== 'idle'
	const isEnded = state.status === 'ended'
	const nextText = getNextText(next, isEnded, t)
	const remainingSec = state.status === 'running' ? state.remainingSec : 0
	const totalSec = state.status === 'idle' ? 1 : state.totalSec

	return (
		<AnimatePresence>
			{isShown && (
				<motion.section
					ref={heightRef}
					variants={isReduced ? sheetReducedVariants : sheetVariants}
					initial="hidden"
					animate="visible"
					exit="hidden"
					className="absolute inset-x-0 bottom-0 z-10 rounded-t-sheet bg-ink pb-safe-bottom"
				>
					<div className="flex flex-col gap-3 px-gutter pt-4 pb-4">
						{isWakeLockUnavailable && state.status === 'running' && <WakeLockHint />}
						<div className="flex items-center gap-4">
							<RestRing
								fraction={remainingSec / totalSec}
								isEnded={isEnded}
								label={t('training.live.rest.timerAria', { time: formatRestTime(remainingSec) })}
								time={formatRestTime(remainingSec)}
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5" aria-live="assertive">
								<Heading level="title" className="text-white">
									{getTitle(next, isEnded, t)}
								</Heading>
								{nextText !== null && (
									<Text as="p" variant="caption" tone="onDark" className="text-white/70">
										{nextText}
									</Text>
								)}
							</div>
						</div>
						{isEnded ? (
							<Button variant="onDark" size="panel" isFullWidth onClick={timer.skip}>
								{t('training.live.rest.toSet')}
							</Button>
						) : (
							<div className="flex gap-2.5">
								<Button
									variant="onDarkQuiet"
									size="panel"
									className="flex-1"
									aria-label={t('training.live.rest.extendAria')}
									onClick={timer.extend}
								>
									{t('training.live.rest.extend')}
								</Button>
								<Button
									variant="onDark"
									size="panel"
									className="flex-1"
									aria-label={t('training.live.rest.skipAria')}
									onClick={timer.skip}
								>
									{t('training.live.rest.skip')}
								</Button>
							</div>
						)}
					</div>
				</motion.section>
			)}
		</AnimatePresence>
	)
}
