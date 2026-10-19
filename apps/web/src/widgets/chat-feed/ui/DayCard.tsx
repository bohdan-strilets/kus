import type { DayCard as DayCardData } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { getMealLabelKey } from '@/entities/entry'
import { CalorieGauge, getDayStats, MacroTiles } from '@/entities/stats'
import { ROUTES } from '@/shared/config'
import { cn, formatInteger, formatSignedInteger, formatTime } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { getDayCardTitle } from '../lib/get-day-label'

interface DayCardProps {
	card: DayCardData
	/** `YYYY-MM-DD` in the user's timezone: «Вчора» and the weekday are told against it. */
	today: string
	/** Kusik's one sentence about the day, inside the card (mockups/chat-day-card.html). */
	note?: string
	/** Next to Kusik's head: the bubble tail at the bottom left. */
	hasTail?: boolean
}

/**
 * docs DayCard — a snapshot of one day as Kusik showed it: the half-ring, what is left (or over —
 * `over-ink`, never red), Б → В → Ж, the meals and a link to that day on «Сьогодні». Every number
 * comes from the snapshot; nothing is counted here and nothing refreshes after later edits.
 */
export const DayCard = ({ card, today, note, hasTail = true }: DayCardProps) => {
	const { t } = useTranslation()
	const { kind, localDate, asOf, totals, goal, remainingKcal, meals } = card
	const stats = getDayStats({ totals, goal })
	const isOver = remainingKcal !== null && remainingKcal < 0
	const aside =
		kind === 'today' && asOf !== null
			? t('chat.dayCard.asOf', { time: formatTime(new Date(asOf)) })
			: t(kind === 'planned' ? 'chat.dayCard.planned' : 'chat.dayCard.wholeDay')

	return (
		<Surface
			as="article"
			radius={hasTail ? 'bubbleAi' : 'card'}
			className={cn('flex flex-col gap-3 p-3.5', hasTail && 'rounded-bl-tail')}
		>
			<header className="flex items-baseline justify-between gap-2">
				<Text as="span" variant="cardTitle">
					{getDayCardTitle(localDate, today, t)}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted">
					{aside}
				</Text>
			</header>
			<div className="flex items-center gap-4">
				<CalorieGauge
					eaten={stats.eaten}
					goal={stats.goal}
					size="compact"
					hasGoalCaptionWhenOver
					revealKey={`day-card:${localDate}:${asOf ?? ''}`}
				/>
				{remainingKcal !== null && (
					<div className="flex min-w-0 flex-col">
						<Text
							as="span"
							weight="extrabold"
							tone={isOver ? 'overInk' : 'ink'}
							isTabular
							className="text-screen-title"
						>
							{isOver ? formatSignedInteger(-remainingKcal) : formatInteger(remainingKcal)}
						</Text>
						<Text as="span" variant="small" weight="regular" tone={isOver ? 'overInk' : 'muted'}>
							{t(isOver ? 'gauge.overGoal' : 'gauge.left')}
						</Text>
					</div>
				)}
			</div>
			<MacroTiles macros={stats.macros} variant="compact" />
			{meals.length > 0 && (
				<ul className="flex flex-col divide-y divide-divider border-t border-divider">
					{meals.map((meal, index) => (
						<li
							key={`${meal.type}-${index}`}
							className="flex items-baseline justify-between py-1.5"
						>
							<Text as="span" variant="cardTitle" weight="semibold">
								{t(getMealLabelKey(meal.type))}
								{kind === 'today' && meal.eatenAt !== null && (
									<Text as="span" variant="small" weight="medium" tone="muted">
										{' '}
										{formatTime(new Date(meal.eatenAt))}
									</Text>
								)}
							</Text>
							<Text as="span" variant="cardTitle" isTabular>
								{formatInteger(meal.kcal)}
							</Text>
						</li>
					))}
				</ul>
			)}
			{note && <Text>{note}</Text>}
			<Link
				to={kind === 'today' ? ROUTES.today : `${ROUTES.today}?date=${localDate}`}
				replace
				className="inline-flex min-h-tap items-center self-start rounded-chip text-card-title font-bold text-primary"
			>
				{t(kind === 'today' ? 'chat.dayCard.openToday' : 'chat.dayCard.openDay')}
			</Link>
		</Surface>
	)
}
