import { useTranslation } from 'react-i18next'

import { formatWorkoutTotal } from '@/entities/workout'
import { Heading, Text } from '@/shared/ui'

import type { WeekSummary } from '../lib/get-week-summary'

/** mockups/training.html header: «Цей тиждень: 1 тренування · 55 хв» over the title. */
export const TrainingHeader = ({ summary }: { summary: WeekSummary | null }) => {
	const { t } = useTranslation()
	const parts =
		summary && summary.count > 0
			? [
					t('training.week.count', { count: summary.count }),
					summary.minutes > 0 ? formatWorkoutTotal(summary.minutes, t) : null,
				].filter((part): part is string => part !== null)
			: []

	return (
		<header className="flex flex-col gap-0.5 px-5 pt-5.5 pb-2.5">
			{summary && (
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{parts.length > 0
						? t('training.week.summary', { parts: parts.join(' · ') })
						: t('training.week.none')}
				</Text>
			)}
			<Heading as="h1">{t('pages.training.title')}</Heading>
		</header>
	)
}
