import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, TRANSITION } from '@/shared/lib'
import { Button, Icon, Text } from '@/shared/ui'

import type { LiveSyncStatus } from '../model/create-live-sync'
import type { LiveNetPhase } from '../model/live-net-phase.types'
import { useLiveNetPhase } from '../model/use-live-net-phase'
import { liveNetPillVariants, liveSyncRingClass } from './live-net-status.variants'

interface LiveNetStatusProps {
	status: LiveSyncStatus
	onRetry: () => void
}

// ICON_SIZE.small is 16; the mockup's pill mark is 14, same as the sync ring
const SAVED_CHECK_SIZE = 14
const PILL_KEY = {
	offline: 'training.live.offline',
	syncing: 'training.live.syncing',
	saved: 'training.live.saved',
} as const satisfies Record<Exclude<LiveNetPhase, 'hidden'>, string>

const PillMark = ({ phase }: { phase: Exclude<LiveNetPhase, 'hidden'> }) => {
	if (phase === 'syncing') return <span aria-hidden="true" className={liveSyncRingClass} />
	if (phase === 'saved') return <Icon name="check" size={SAVED_CHECK_SIZE} />
	return (
		<span
			aria-hidden="true"
			className="box-border size-2.5 flex-none rounded-full border-2 border-muted"
		/>
	)
}

/**
 * Under the live header: a pill while the sets wait for the connection, then «Синхронізую…» and a
 * short «Збережено» (0.10.6). A server refusal stays the line with «Спробувати ще», as before.
 */
export const LiveNetStatus = ({ status, onRetry }: LiveNetStatusProps) => {
	const { t } = useTranslation()
	const phase = useLiveNetPhase(status)
	const isReduced = useReducedMotion()
	const transition = isReduced ? { duration: 0 } : TRANSITION.base

	return (
		<div role="status" aria-live="polite" className={cn(status === 'error' && 'pb-1.5')}>
			<AnimatePresence initial={false}>
				{phase !== 'hidden' && (
					<motion.div
						key="pill"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={transition}
						className="px-gutter pb-1.5"
					>
						{/* min-h keeps the row's height while the two pills swap (mode="wait" leaves a gap) */}
						<div className="min-h-8">
							<AnimatePresence initial={false} mode="wait">
								<motion.span
									key={phase === 'saved' ? 'saved' : 'net'}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={transition}
									className={liveNetPillVariants({ phase })}
								>
									<PillMark phase={phase} />
									{t(PILL_KEY[phase])}
								</motion.span>
							</AnimatePresence>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
			{status === 'error' && (
				<div className="flex items-center justify-between gap-2 px-gutter">
					<Text variant="caption" tone="mutedStrong">
						{t('training.live.syncError')}
					</Text>
					<Button size="sm" variant="textOnBackground" onClick={onRetry}>
						{t('common.retry')}
					</Button>
				</div>
			)}
		</div>
	)
}
