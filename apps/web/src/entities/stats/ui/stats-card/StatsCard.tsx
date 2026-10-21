import type { StatsCard as StatsCardData } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { cn, formatInteger, formatSignedDecimal } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { getStatsCardView } from '../../lib/get-stats-card-view'
import { StatsDayList } from './StatsDayList'
import { StatsTile } from './StatsTile'

export interface StatsCardProps {
	card: StatsCardData
	/** `YYYY-MM-DD` in the user's timezone: tells «За 7 днів» from a finished week. */
	today: string
	/** Kusik's sentence about the period, inside the card; facts only. */
	note?: string
	/** Next to Kusik's head: the bubble tail at the bottom left. */
	hasTail?: boolean
}

/**
 * docs StatsCard (mockups/chat-stats-card.html): a period as Kusik showed it on request — the
 * averages over the days with entries, the days in the norm and the weight change. Fewer than
 * STATS_CARD_MIN_LOGGED_DAYS days with entries: the count and the days themselves, no averages.
 * Every number is the backend's.
 */
export const StatsCard = ({ card, today, note, hasTail = true }: StatsCardProps) => {
	const { t } = useTranslation()
	const { avgKcal, avgProteinG, goalKcal, daysInNorm, loggedDays, weightChangeKg } = card
	const view = getStatsCardView(card, today, t)

	return (
		<Surface
			as="article"
			variant="glass"
			radius={hasTail ? 'bubbleAi' : 'card'}
			className={cn('flex flex-col gap-3 p-3.5', hasTail && 'rounded-bl-tail')}
		>
			<header className="flex flex-col">
				<Text as="p" variant="stat">
					{view.title}
				</Text>
				<Text as="p" variant="small" weight="regular" tone="muted">
					{view.subtitle}
				</Text>
			</header>
			{view.isSparse ? (
				<>
					<StatsTile
						label={t('chat.statsCard.loggedDays')}
						value={t('chat.statsCard.loggedDaysValue', {
							logged: formatInteger(loggedDays),
							total: formatInteger(view.totalDays),
						})}
					/>
					{view.dayRows.length > 0 && <StatsDayList rows={view.dayRows} />}
				</>
			) : (
				<div className="grid grid-cols-2 gap-2">
					{avgKcal !== null && (
						<StatsTile
							tone="kcal"
							label={t('chat.statsCard.avgKcal')}
							value={formatInteger(avgKcal)}
							caption={
								goalKcal === null
									? undefined
									: t('chat.statsCard.goalKcal', { goal: formatInteger(goalKcal) })
							}
						/>
					)}
					{avgProteinG !== null && (
						<StatsTile
							tone="protein"
							label={t('chat.statsCard.avgProtein')}
							value={`${formatInteger(avgProteinG)}${t('macro.grams')}`}
							caption={
								view.proteinGoal === null
									? undefined
									: t('chat.statsCard.goalProtein', { goal: view.proteinGoal })
							}
						/>
					)}
					<StatsTile
						tone="norm"
						label={t('chat.statsCard.daysInNorm')}
						value={t('chat.statsCard.daysInNormValue', {
							norm: formatInteger(daysInNorm),
							logged: formatInteger(loggedDays),
						})}
						caption={view.hasLoggedDaysCaption ? t('chat.statsCard.daysInNormCaption') : undefined}
					/>
					{weightChangeKg !== null && (
						<StatsTile
							tone="weight"
							label={t('chat.statsCard.weight')}
							value={t('measurement.kg', { value: formatSignedDecimal(weightChangeKg) })}
							caption={view.weightRange ?? undefined}
						/>
					)}
				</div>
			)}
			{note && <Text>{note}</Text>}
		</Surface>
	)
}
