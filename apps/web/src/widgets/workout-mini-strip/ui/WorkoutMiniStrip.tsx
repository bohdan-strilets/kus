import type { LiveWorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatElapsed, getElapsedMinutes } from '@/features/live-workout'
import { TRAINING_LIVE_ROUTE } from '@/shared/config'
import { useNow } from '@/shared/lib'
import { Text } from '@/shared/ui'

const TICK_MS = 1000

/**
 * mockups/training-home.html: while a live session is open, a 48px `ink` strip over the bottom
 * nav on every tab — a `success` dot, «Тренування Б · 23:14» and «Відкрити». The whole strip is the
 * link; the dot is decoration, the name and the time carry the meaning.
 */
export const WorkoutMiniStrip = ({ live }: { live: LiveWorkoutResponse }) => {
	const { t } = useTranslation()
	const now = useNow(TICK_MS)
	const name = live.templateName ?? t('training.live.defaultName')
	const elapsed = formatElapsed(live.workout.startedAt, now)
	const minutes = getElapsedMinutes(live.workout.startedAt, now)

	return (
		<Link
			to={TRAINING_LIVE_ROUTE}
			aria-label={t('training.strip.label', { name, minutes })}
			className="mx-gutter flex min-h-12 items-center gap-2.5 rounded-button bg-ink py-0 pr-2 pl-3.5 text-white shadow-float focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
		>
			<span aria-hidden="true" className="size-2.5 flex-none rounded-full bg-success" />
			<Text as="span" variant="cardTitle" tone="onDark" className="flex-1 truncate" isTabular>
				{`${name} · ${elapsed}`}
			</Text>
			<span
				aria-hidden="true"
				className="flex min-h-9 items-center rounded-chip bg-white/14 px-3 text-caption font-bold"
			>
				{t('training.strip.open')}
			</span>
		</Link>
	)
}
