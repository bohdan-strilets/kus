import type { MeasurementCard } from '@kus/shared'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { cn, formatDayMonthShort, toCalendarDate, TRANSITION } from '@/shared/lib'
import { Button, Sparkline, Surface, Text } from '@/shared/ui'

import {
	formatMeasurement,
	formatMeasurementDelta,
	formatMeasurementNumber,
} from '../../lib/format-measurement'
import { getGoalTile } from '../../lib/get-goal-tile'
import { formatPaceSentence, getPaceSentenceKey } from '../../lib/get-pace-sentence'
import { StatTile } from '../stat-tile/StatTile'

export interface WeightCardProps {
	card: MeasurementCard
	/** `YYYY-MM-DD` in the user's timezone: the last chart label says «сьогодні» only on this day. */
	today: string
	/** Kusik's words (no numbers): they follow the numeric sentence inside the card. */
	note?: string
	/** Next to Kusik's head; under his words it is an attachment without the tail. */
	hasTail?: boolean
	/** The reply just arrived: the card rises in softly (reduced motion drops the move). */
	isFresh?: boolean
	/** The entrance is over: the card is no longer «fresh». */
	onEntered?: () => void
	/** «Редагувати»; the editor lives in a feature, so the page above passes it down. Without it there is no button. */
	onEdit?: () => void
}

/**
 * docs WeightCard (mockups/chat-weight.html): «Вагу записано» with the value, the 5-week mini chart,
 * «Від старту» / «До цілі», one sentence and the way to «Прогрес». The same card shows the waist,
 * without a goal. Every number is the backend's.
 */
export const WeightCard = ({
	card,
	today,
	note,
	hasTail = true,
	isFresh = false,
	onEntered,
	onEdit,
}: WeightCardProps) => {
	const { t } = useTranslation()
	const { kind, chart } = card
	const first = chart[0]
	const last = chart[chart.length - 1]
	const hasHistory = chart.length > 1
	const goalTile = getGoalTile(card)
	const paceKey = getPaceSentenceKey({ kind, weekChange: card.weekChange })
	const pace =
		paceKey && card.weekChange !== null
			? formatPaceSentence(t, paceKey, card.weekChange, kind)
			: null
	const sentence = [pace, note].filter(Boolean).join(' ')
	const chartLabel =
		hasHistory && first && last
			? t(`measurement.chart.range.${kind}`, {
					from: formatMeasurement(first.value, kind, t),
					to: formatMeasurement(last.value, kind, t),
				})
			: t(`measurement.chart.single.${kind}`, { value: formatMeasurement(card.value, kind, t) })
	const lastLabel =
		card.localDate === today
			? t('measurement.chart.today')
			: formatDayMonthShort(toCalendarDate(card.localDate))

	return (
		<motion.div
			initial={isFresh ? { opacity: 0, y: 8 } : false}
			animate={{ opacity: 1, y: 0 }}
			transition={TRANSITION.slow}
			onAnimationComplete={onEntered}
		>
			<Surface
				variant="glass"
				radius={hasTail ? 'bubbleAi' : 'card'}
				className={cn('flex flex-col gap-3 p-3.5', hasTail && 'rounded-bl-tail')}
			>
				<div className="flex items-center justify-between">
					<Text as="span" variant="cardTitle">
						{t(`measurement.title.${kind}`)}
						{card.source === 'EDIT' && (
							<Text as="span" variant="cardTitle" weight="medium" tone="muted">
								{' '}
								· {t('measurement.edited')}
							</Text>
						)}
					</Text>
					<span className="rounded-badge bg-success-soft px-2.5 py-1 text-card-title font-extrabold text-success-ink tabular-nums">
						{formatMeasurement(card.value, kind, t)}
					</span>
				</div>

				{chart.length > 0 && (
					<Surface
						variant="field"
						radius="tile"
						shadow="none"
						className="flex flex-col gap-1 px-2.5 pt-2.5 pb-1"
					>
						<Sparkline values={chart.map((point) => point.value)} label={chartLabel} />
						<div className="flex justify-between text-small text-muted tabular-nums">
							{hasHistory && first && (
								<span>
									{t('measurement.chart.start', {
										date: formatDayMonthShort(toCalendarDate(first.localDate)),
										value: formatMeasurementNumber(first.value, kind),
									})}
								</span>
							)}
							<span className="ml-auto">{lastLabel}</span>
						</div>
					</Surface>
				)}

				{(card.fromStart !== null || goalTile) && (
					<div
						className={cn(
							'grid gap-2',
							card.fromStart !== null && goalTile ? 'grid-cols-2' : 'grid-cols-1',
						)}
					>
						{card.fromStart !== null && (
							<StatTile
								tone="success"
								label={t('measurement.fromStart')}
								value={formatMeasurementDelta(card.fromStart, kind, t)}
							/>
						)}
						{goalTile && (
							<StatTile
								tone="goal"
								label={t('measurement.toGoal')}
								value={
									goalTile.kind === 'reached'
										? t('measurement.goalReached')
										: formatMeasurement(goalTile.kg, kind, t)
								}
							/>
						)}
					</div>
				)}

				{sentence && <Text>{sentence}</Text>}

				<div className="flex items-center justify-between gap-3">
					<Link
						to={ROUTES.progress}
						className="relative rounded-tile-sm after:absolute after:inset-x-0 after:-inset-y-3.5"
					>
						<Text as="span" variant="cardTitle" tone="primary">
							{t('measurement.openProgress')}
						</Text>
					</Link>
					{onEdit && (
						<Button variant="secondary" size="sm" onClick={onEdit}>
							{t('measurement.edit')}
						</Button>
					)}
				</div>
			</Surface>
		</motion.div>
	)
}
