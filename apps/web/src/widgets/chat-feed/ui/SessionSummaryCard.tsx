import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import {
	formatWorkoutDuration,
	formatWorkoutKcalNote,
	formatWorkoutKind,
	GroupTag,
} from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { cn, formatTime } from '@/shared/lib'
import { Badge, Icon, Surface, Text } from '@/shared/ui'

import { getSessionSummary } from '../lib/get-session-summary'

const RECORD_ICON_SIZE = 16
const CHEVRON_SIZE = 16

export interface SessionSummaryCardProps {
	workout: WorkoutResponse
	/** Next to Kusik's head the card has a tail; under his words it is an attachment. */
	hasTail: boolean
}

/**
 * mockups/chat-training.html (A): the whole session in one card — the place and the start with the
 * duration, the counts, a plate per group, the records, the named kcal and the way into the session.
 */
export const SessionSummaryCard = ({ workout, hasTail }: SessionSummaryCardProps) => {
	const { t } = useTranslation()
	const { counts, groups, records } = getSessionSummary(workout, t)
	const duration = formatWorkoutDuration(workout, t)
	const kcalNote = formatWorkoutKcalNote(workout, t)

	return (
		<Surface
			variant="solid"
			radius="bubbleAi"
			className={cn('flex flex-col gap-2.5 px-3.5 py-3', hasTail && 'rounded-bl-tail')}
		>
			<div className="flex items-center justify-between gap-2">
				<Text as="span" variant="cardTitle">
					{formatWorkoutKind(workout.place, t)}
					{workout.startedAt !== null && (
						<Text as="span" variant="cardTitle" weight="medium" tone="muted">
							{' '}
							· {formatTime(new Date(workout.startedAt))}
						</Text>
					)}
				</Text>
				{duration !== null && <Badge variant="training">{duration}</Badge>}
			</div>
			{counts !== null && (
				<Text variant="caption" weight="regular" tone="mutedStrong">
					{counts}
				</Text>
			)}
			{groups.length > 0 && (
				<div className="flex flex-wrap gap-1.25">
					{groups.map(({ group, detail }) => (
						<GroupTag key={group} group={group} size="sm" detail={detail} />
					))}
				</div>
			)}
			{records.map((record) => (
				<div
					key={record}
					className="flex items-center gap-2 rounded-tile-sm bg-success-soft px-2.5 py-2"
				>
					<Icon name="trophy" size={RECORD_ICON_SIZE} className="flex-none text-success-ink" />
					<Text as="span" variant="caption" weight="bold" tone="successInk">
						{record}
					</Text>
				</div>
			))}
			{kcalNote !== null && (
				<Text variant="small" tone="muted">
					{kcalNote}
				</Text>
			)}
			<Link
				to={getTrainingSessionPath(workout.id)}
				className="-mb-1.5 flex min-h-tap items-center gap-1 self-start"
			>
				<Text as="span" variant="cardTitle" tone="primary">
					{t('workout.summary.open')}
				</Text>
				<Icon name="chevron-right" size={CHEVRON_SIZE} className="flex-none text-primary" />
			</Link>
		</Surface>
	)
}
