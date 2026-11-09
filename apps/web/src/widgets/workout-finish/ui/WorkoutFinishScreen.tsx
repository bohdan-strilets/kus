import type { WorkoutFinished } from '@kus/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROGRAM_QUERY_KEY } from '@/entities/program'
import {
	formatSessionHeader,
	formatWorkoutKcal,
	getSessionSummary,
	getWorkoutCounts,
	GroupTag,
	KcalNote,
	SessionTiles,
	formatWorkoutDuration,
} from '@/entities/workout'
import { getTrainingSessionPath } from '@/shared/config'
import { playSound } from '@/shared/lib'
import { Button, Hamster, HAMSTER_LABEL_KEYS, Heading, Icon, Surface, Text } from '@/shared/ui'

import { formatFinishSubtitle } from '../lib/format-finish-subtitle'

const HAMSTER_SIZE = 120
const RECORD_ICON_SIZE = 16

interface WorkoutFinishScreenProps {
	finished: WorkoutFinished
	/** «Готово». */
	onDone: () => void
}

/**
 * mockups/training-live.html «Зведення» (and training-form «Після «Зберегти»»): the same screen
 * after the live mode and after the form. A new record — the hamster with a trophy and the `achieve`
 * sound together with the record rows; otherwise a happy one. The chat got its card from the
 * backend, so the feed and the program's «next» are read again here.
 */
export const WorkoutFinishScreen = ({ finished, onDone }: WorkoutFinishScreenProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const { workout, hasNewRecord } = finished
	const header = formatSessionHeader(workout, t)
	const { groups, records } = getSessionSummary(workout, t)
	const counts = getWorkoutCounts(workout.exercises)
	const kcal = formatWorkoutKcal(workout.kcal, t)
	const mood = hasNewRecord ? 'record' : 'happy'

	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY })
	}, [queryClient])
	useEffect(() => {
		if (hasNewRecord) playSound('achieve')
	}, [hasNewRecord])

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 px-gutter pt-8 pb-4">
			<div className="flex flex-1 flex-col items-center gap-3">
				<Hamster mood={mood} size={HAMSTER_SIZE} label={t(HAMSTER_LABEL_KEYS[mood])} />
				<div className="flex flex-col items-center gap-0.5 text-center">
					<Heading as="h1" title={header.title} className="line-clamp-2">
						{header.title}
					</Heading>
					<Text variant="caption" tone="muted">
						{formatFinishSubtitle(workout, t)}
					</Text>
				</div>
				<div className="w-full">
					<SessionTiles
						duration={formatWorkoutDuration(workout, t)}
						strength={
							counts.exerciseCount > 0
								? { exerciseCount: counts.exerciseCount, setCount: counts.setCount }
								: null
						}
						cardio={counts.hasCardio ? { minutes: counts.cardioMinutes, distanceM: null } : null}
					/>
				</div>
				<Surface radius="card" className="flex w-full flex-col gap-2.5 p-3.5">
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
					{kcal !== null && (
						<Text variant="caption" weight="regular" tone="mutedStrong">
							<KcalNote view={kcal} />
						</Text>
					)}
				</Surface>
				<Text variant="small" tone="muted" className="text-center">
					{t('training.finish.chatNote')}
				</Text>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Button isFullWidth onClick={onDone}>
					{t('training.finish.done')}
				</Button>
				<Link
					to={getTrainingSessionPath(workout.id)}
					replace
					className="flex min-h-tap items-center px-4 text-card-title font-bold text-primary-deep underline underline-offset-2"
				>
					{t('workout.summary.open')}
				</Link>
			</div>
		</div>
	)
}
