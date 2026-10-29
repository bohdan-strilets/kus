import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { workoutsRangeQueryOptions } from '@/entities/workout'
import { ROUTES } from '@/shared/config'
import { DecorBackdrop } from '@/shared/ui'

import { getTrainingRange } from '../lib/get-training-range'
import { getWeekSummary } from '../lib/get-week-summary'
import { groupWorkoutsByDay } from '../lib/group-workouts'
import { TrainingEmpty } from './TrainingEmpty'
import { TrainingError } from './TrainingError'
import { TrainingHeader } from './TrainingHeader'
import { TrainingList } from './TrainingList'
import { TrainingSkeleton } from './TrainingSkeleton'

/** design/docs/screens.md → Тренування: the week in numbers, the trainings by day, newest first. */
export const TrainingPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return <TrainingScreen timeZone={user.timezone} />
}

const TrainingScreen = ({ timeZone }: { timeZone: string }) => {
	const navigate = useNavigate()
	const today = useLocalToday(timeZone)
	const query = useQuery(workoutsRangeQueryOptions(getTrainingRange(today)))
	const workouts = query.data
	const isEmpty = workouts?.length === 0

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, as on today-empty */}
			{isEmpty && <DecorBackdrop />}
			<TrainingHeader summary={workouts ? getWeekSummary(workouts, today) : null} />
			{isEmpty ? (
				<TrainingEmpty
					onAction={() => {
						void navigate(ROUTES.chat, { replace: true })
					}}
				/>
			) : (
				<div className="flex flex-col px-gutter pb-2">
					{workouts && <TrainingList groups={groupWorkoutsByDay(workouts)} today={today} />}
					{!workouts && query.isError && <TrainingError onRetry={() => void query.refetch()} />}
					{query.isPending && <TrainingSkeleton />}
				</div>
			)}
		</div>
	)
}
