import type { TFunction } from 'i18next'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import {
	formatRestSet,
	formatRestTime,
	type RestNext,
	type RestTimer,
} from '@/features/live-workout'
import { sheetVariants } from '@/shared/lib'
import { Button, Heading, Text } from '@/shared/ui'

import { RestRing } from './RestRing'

interface RestTimerPanelProps {
	timer: RestTimer
}

const getNextText = (next: RestNext | null, isEnded: boolean, t: TFunction): string | null => {
	if (next === null) return null
	const set = formatRestSet(next.exercise, next.set, t)
	if (next.isOtherExercise)
		return t('training.live.rest.nextExercise', { exercise: next.exercise.name, set })
	return isEnded ? set : t('training.live.rest.nextSet', { n: next.setNumber, set })
}

/**
 * mockups/training-rest.html: a panel from the bottom on `ink` — the ring, «Відпочинок» and what
 * comes next, [+15 с] [Пропустити]; at the end «Час! Підхід N» and one [До підходу]. The end is
 * announced to a screen reader (`aria-live="assertive"`). The «на паузі» state of the mockup is
 * not made: the time is counted from `doneAt`, so there is nothing to pause.
 */
export const RestTimerPanel = ({ timer }: RestTimerPanelProps) => {
	const { t } = useTranslation()
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
					variants={sheetVariants}
					initial="hidden"
					animate="visible"
					exit="hidden"
					className="flex-none rounded-t-sheet bg-ink pb-safe-bottom"
				>
					<div className="flex flex-col gap-3 px-gutter pt-4 pb-4">
						<div className="flex items-center gap-4">
							<RestRing
								fraction={remainingSec / totalSec}
								isEnded={isEnded}
								label={t('training.live.rest.timerAria', { time: formatRestTime(remainingSec) })}
								time={formatRestTime(remainingSec)}
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-0.5" aria-live="assertive">
								<Heading level="title" className="text-white">
									{isEnded && next !== null
										? t('training.live.rest.over', { n: next.setNumber })
										: t('training.live.rest.title')}
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
