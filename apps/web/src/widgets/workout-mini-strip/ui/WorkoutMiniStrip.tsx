import type { LiveWorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatElapsed } from '@/features/live-workout'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { cn, useNow } from '@/shared/lib'
import { Text } from '@/shared/ui'

const TICK_MS = 1000

/**
 * mockups/training-home.html: while a live session is open, a 48px `ink` strip over the bottom
 * nav on every tab — a `success` dot, «Тренування Б · 23:14» and «Відкрити». The whole strip is the
 * link; the dot is decoration, the name and the time carry the meaning. The live screen unfolds from it
 * (`data-mini-strip` is how the screen finds the strip's rectangle).
 */
interface WorkoutMiniStripProps {
	live: LiveWorkoutResponse
	/** The finger came down on the strip: the app warms up what the live screen needs. */
	onWarm?: () => void
	/** No connection: an empty ring instead of the green dot, and the spoken label says so. */
	isOffline?: boolean
}

export const WorkoutMiniStrip = ({ live, onWarm, isOffline = false }: WorkoutMiniStripProps) => {
	const { t } = useTranslation()
	const now = useNow(TICK_MS)
	const name = live.templateName ?? t('training.live.defaultName')
	const elapsed = formatElapsed(live.workout.startedAt, now)

	return (
		<Link
			to={TRAINING_LIVE_ROUTE}
			data-mini-strip=""
			onPointerDown={onWarm}
			aria-label={t(isOffline ? 'training.strip.labelOffline' : 'training.strip.label', {
				name,
				elapsed,
			})}
			className="mx-gutter flex min-h-12 items-center gap-2.5 rounded-button bg-ink py-0 pr-2 pl-3.5 text-white shadow-float focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
		>
			<span
				aria-hidden="true"
				className={cn(
					'size-2.5 flex-none rounded-full',
					isOffline ? 'box-border border-2 border-white/70' : 'bg-success',
				)}
			/>
			<span aria-hidden="true" title={name} className="flex min-w-0 flex-1 items-baseline">
				<Text as="span" variant="cardTitle" tone="onDark" className="min-w-0 truncate">
					{name}
				</Text>
				<Text
					as="span"
					variant="cardTitle"
					tone="onDark"
					className="shrink-0 whitespace-pre"
					isTabular
				>
					{` · ${elapsed}`}
				</Text>
			</span>
			<span
				aria-hidden="true"
				className="flex min-h-9 items-center rounded-chip bg-white/14 px-3 text-caption font-bold"
			>
				{t('training.strip.open')}
			</span>
		</Link>
	)
}
