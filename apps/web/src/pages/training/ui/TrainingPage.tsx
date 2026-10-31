import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useLocalToday } from '@/entities/day'
import { useSessionUser } from '@/entities/session'
import { workoutsRangeQueryOptions } from '@/entities/workout'
import { ROUTES } from '@/shared/config'
import { DecorBackdrop, InlineError } from '@/shared/ui'

import { getTrainingRange } from '../lib/get-training-range'
import { getWeekSummary } from '../lib/get-week-summary'
import { groupWorkoutsByMonth } from '../lib/group-workouts'
import { TrainingEmpty } from './TrainingEmpty'
import { TrainingHeader } from './TrainingHeader'
import { TrainingMonth } from './TrainingMonth'
import { TrainingSkeleton } from './TrainingSkeleton'
import { TrainingWeek } from './TrainingWeek'

/** design/docs/screens.md → Тренування: the week in a card, the trainings by month and day, newest first. */
export const TrainingPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return <TrainingScreen timeZone={user.timezone} />
}

const TrainingScreen = ({ timeZone }: { timeZone: string }) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const today = useLocalToday(timeZone)
	const query = useQuery(workoutsRangeQueryOptions(getTrainingRange(today)))
	const workouts = query.data
	const isEmpty = workouts?.length === 0

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, as on today-empty */}
			{isEmpty && <DecorBackdrop />}
			<TrainingHeader isEmpty={isEmpty} />
			{isEmpty ? (
				<TrainingEmpty
					onAction={() => {
						void navigate(ROUTES.chat, { replace: true })
					}}
				/>
			) : (
				<div className="flex flex-col gap-2.5 px-gutter pb-2">
					{workouts && (
						<>
							<TrainingWeek summary={getWeekSummary(workouts, today)} />
							{groupWorkoutsByMonth(workouts).map((month) => (
								<TrainingMonth key={month.monthKey} month={month} />
							))}
						</>
					)}
					{!workouts && query.isError && (
						<InlineError message={t('training.loadError')} onRetry={() => void query.refetch()} />
					)}
					{query.isPending && <TrainingSkeleton />}
				</div>
			)}
		</div>
	)
}
