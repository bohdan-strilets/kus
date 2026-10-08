import { useTranslation } from 'react-i18next'

import { cn, formatInteger, formatSignedInteger, RING_FILL_MS, useCountUp } from '@/shared/lib'
import { Icon, Text } from '@/shared/ui'

import { getGaugeState } from '../../lib/get-gauge-state'
import { GAUGE_GEOMETRY, type GaugeSize } from './calorie-gauge.constants'
import { GaugeArcs } from './GaugeArcs'

export interface CalorieGaugeProps {
	eaten: number
	/** null without a goal: the empty track and only what was eaten. */
	goal: number | null
	/** compact — chat header; large — «Сьогодні». */
	size?: GaugeSize
}

const CLOSED_ICON_SIZE = 30

/**
 * docs CalorieRing / Gauge, four states (mockups/brand-calorie-ring-states.html):
 * under — what's left (large) or eaten «з 2 200 ккал» (compact); closed — a check and «ціль дня
 * закрита»; over — «+180» in `over`, never red, no sound; the over arc stops at +50 %.
 */
export const CalorieGauge = ({ eaten, goal, size = 'large' }: CalorieGaugeProps) => {
	const { t } = useTranslation()
	const state = getGaugeState(eaten, goal ?? 0)
	const { frameClass } = GAUGE_GEOMETRY[size]
	const isLarge = size === 'large'
	const hasGoal = goal !== null
	const centreNumber = isLarge && hasGoal ? state.remaining : eaten
	const countRef = useCountUp<HTMLSpanElement>(centreNumber, { durationMs: RING_FILL_MS })

	const renderCentre = () => {
		if (!hasGoal) {
			return (
				<>
					<span
						ref={countRef}
						className={cn('tabular-nums', isLarge ? 'text-gauge' : 'text-title')}
					>
						{formatInteger(eaten)}
					</span>
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('gauge.eaten')}
					</Text>
				</>
			)
		}
		if (isLarge && state.status === 'closed') {
			return (
				<>
					<Icon name="check" size={CLOSED_ICON_SIZE} className="text-success" />
					<Text as="span" variant="small" tone="success">
						{t('gauge.goalClosed')}
					</Text>
				</>
			)
		}
		if (isLarge && state.status === 'over') {
			return (
				<>
					{/* 28px is large text, so `over` itself passes contrast; the caption uses over-ink */}
					<Text as="span" variant="gauge" tone="over">
						{formatSignedInteger(state.over)}
					</Text>
					<Text as="span" variant="small" tone="overInk">
						{t('gauge.overGoal')}
					</Text>
				</>
			)
		}
		return (
			<>
				<span ref={countRef} className={cn('tabular-nums', isLarge ? 'text-gauge' : 'text-title')}>
					{formatInteger(centreNumber)}
				</span>
				{isLarge && (
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('gauge.left')}
					</Text>
				)}
				{!isLarge && state.status === 'over' && (
					<Text as="span" variant="small" weight="bold" tone="overInk">
						{t('gauge.overShort', { over: formatSignedInteger(state.over) })}
					</Text>
				)}
				{!isLarge && state.status !== 'over' && (
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('gauge.ofGoal', { goal: formatInteger(goal) })}
					</Text>
				)}
			</>
		)
	}

	return (
		<div
			role="img"
			aria-label={
				hasGoal
					? t('gauge.label', { eaten: formatInteger(eaten), goal: formatInteger(goal) })
					: t('gauge.labelNoGoal', { eaten: formatInteger(eaten) })
			}
			className={cn('relative shrink-0', frameClass)}
		>
			<GaugeArcs size={size} state={state} />
			<div
				aria-hidden="true"
				className={cn(
					'absolute inset-x-0 flex flex-col items-center text-ink',
					isLarge ? 'bottom-0.5' : 'bottom-0',
				)}
			>
				{renderCentre()}
			</div>
		</div>
	)
}
