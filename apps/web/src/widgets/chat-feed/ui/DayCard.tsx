import type { DayCard as DayCardData } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { CalorieGauge, getDayStats, MacroTiles } from '@/entities/stats'
import { ROUTES } from '@/shared/config'
import {
	cn,
	formatInteger,
	formatSignedInteger,
	formatShortDate,
	formatTime,
	getDayRelation,
	toCalendarDate,
} from '@/shared/lib'
import { Badge, Surface, Text } from '@/shared/ui'

import { getDayCardVerdictView } from '../lib/get-day-card-verdict'
import { getDayCardTitle } from '../lib/get-day-label'
import { DayCardMealRow } from './DayCardMealRow'
import { DayCardVerdictAside } from './DayCardVerdictAside'

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
 * A closing card (`isClosing`, mockups/chat-day-closed.html) swaps «на 21:40» for «День закрито»
 * and tells how the day went with a fixed sentence instead of the model's note.
 */
export const DayCard = ({ card, today, note, hasTail = true }: DayCardProps) => {
	const { t } = useTranslation()
	const { kind, localDate, asOf, totals, goal, remainingKcal, meals, isClosing = false } = card
	const stats = getDayStats({ totals, goal })
	const verdictView = getDayCardVerdictView(card)
	const isOver = remainingKcal !== null && remainingKcal < 0
	// The link follows the snapshot's date, not its kind: a «today» card from yesterday opens yesterday.
	const isSnapshotToday = getDayRelation(localDate, today) === 'today'
	const sentence = verdictView
		? verdictView.sentence && t(verdictView.sentence.key, verdictView.sentence.values)
		: note
	const getTitle = (): string =>
		isClosing && isSnapshotToday
			? t('chat.dayCard.todayDated', { date: formatShortDate(toCalendarDate(localDate)) })
			: getDayCardTitle(localDate, today, t)
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
			<header className="flex items-center justify-between gap-2">
				<Text as="span" variant="cardTitle">
					{getTitle()}
				</Text>
				{isClosing ? (
					<Badge variant={verdictView?.verdict === 'on_goal' ? 'closed' : 'closedNeutral'}>
						{t('chat.dayCard.closed')}
					</Badge>
				) : (
					<Text as="span" variant="small" weight="regular" tone="muted">
						{aside}
					</Text>
				)}
			</header>
			{verdictView && !verdictView.hasRing ? (
				<div className="flex flex-col gap-px">
					<Text as="span" variant="gauge" isTabular>
						{formatInteger(totals.kcal)}{' '}
						<Text as="span" weight="semibold" tone="muted">
							{t('gauge.kcal')}
						</Text>
					</Text>
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('chat.dayCard.noGoalCaption')}
					</Text>
				</div>
			) : (
				<div className="flex items-center gap-4">
					<CalorieGauge
						eaten={stats.eaten}
						goal={stats.goal}
						size="compact"
						hasGoalCaptionWhenOver
						revealKey={`day-card:${localDate}:${asOf ?? ''}`}
					/>
					{verdictView && <DayCardVerdictAside aside={verdictView.aside} />}
					{!verdictView && remainingKcal !== null && (
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
			)}
			<MacroTiles macros={stats.macros} variant="compact" />
			{meals.length > 0 && (
				<ul className="flex flex-col divide-y divide-divider border-t border-divider">
					{meals.map((meal, index) => (
						<DayCardMealRow key={`${meal.type}-${index}`} meal={meal} hasTime={kind === 'today'} />
					))}
				</ul>
			)}
			{sentence && <Text>{sentence}</Text>}
			<Link
				to={isSnapshotToday ? ROUTES.today : `${ROUTES.today}?date=${localDate}`}
				replace
				className="inline-flex min-h-tap items-center self-start rounded-chip text-card-title font-bold text-primary"
			>
				{t(isSnapshotToday ? 'chat.dayCard.openToday' : 'chat.dayCard.openDay')}
			</Link>
		</Surface>
	)
}
