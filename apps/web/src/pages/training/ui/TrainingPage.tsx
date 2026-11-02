import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useLocalToday } from '@/entities/day'
import { profileQueryOptions } from '@/entities/profile'
import { useActiveProgram } from '@/entities/program'
import { useSessionUser } from '@/entities/session'
import { workoutsRangeQueryOptions } from '@/entities/workout'
import { ROUTES } from '@/shared/config'
import { DecorBackdrop, InlineError } from '@/shared/ui'

import { getTrainingRange } from '../lib/get-training-range'
import { groupWorkoutsByMonth } from '../lib/group-workouts'
import { TrainingEmpty } from './TrainingEmpty'
import { TrainingHeader } from './TrainingHeader'
import { TrainingInvite } from './TrainingInvite'
import { TrainingMonth } from './TrainingMonth'
import { TrainingProgramBlocks } from './TrainingProgramBlocks'
import { TrainingProgramSkeleton } from './TrainingProgramSkeleton'
import { TrainingSkeleton } from './TrainingSkeleton'
import { TrainingTiles } from './TrainingTiles'
import { TrainingWeek } from './TrainingWeek'

/**
 * design/docs/screens.md → Тренування: with a program «Наступне» and the templates on top, then the
 * week in a card and the trainings by month, newest first. Without a program (and with no
 * training yet) the first visit invites to the setup in the chat.
 */
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
	const programQuery = useActiveProgram()
	// undefined while loading or failed: the program blocks stay hidden, the journal works
	const program = programQuery.data
	const hasNoProgram = program === null
	const profileQuery = useQuery({ ...profileQueryOptions, enabled: hasNoProgram })
	const workouts = query.data
	const isEmpty = workouts?.length === 0
	const isInviteShown = isEmpty && hasNoProgram && profileQuery.data?.trainingOnboardingAt === null
	const isEmptyDeciding =
		isEmpty && (programQuery.isPending || (hasNoProgram && profileQuery.isPending))
	const isEmptyShown = isEmpty && !isInviteShown && !isEmptyDeciding
	const tiles = <TrainingTiles today={today} isStatsShown={!isEmpty} program={program} />

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, as on today-empty */}
			{isEmptyShown && <DecorBackdrop />}
			<TrainingHeader isEmpty={isEmptyShown} />
			{isInviteShown && <TrainingInvite />}
			{isEmptyDeciding && (
				<div className="px-gutter pb-2">
					<TrainingSkeleton />
				</div>
			)}
			{isEmptyShown && (
				<>
					{program !== undefined && (
						<div className="flex flex-col gap-2.5 px-gutter pb-2">
							{program && <TrainingProgramBlocks program={program} />}
							{tiles}
						</div>
					)}
					<TrainingEmpty
						onAction={() => {
							void navigate(ROUTES.chat, { replace: true })
						}}
					/>
				</>
			)}
			{!isEmpty && (
				<div className="flex flex-col gap-2.5 px-gutter pb-2">
					{workouts && programQuery.isPending && <TrainingProgramSkeleton />}
					{workouts && program && <TrainingProgramBlocks program={program} />}
					{workouts && program && tiles}
					{workouts && <TrainingWeek today={today} journal={workouts} program={program} />}
					{workouts && !program && tiles}
					{workouts &&
						groupWorkoutsByMonth(workouts).map((month) => (
							<TrainingMonth key={month.monthKey} month={month} />
						))}
					{!workouts && query.isError && (
						<InlineError message={t('training.loadError')} onRetry={() => void query.refetch()} />
					)}
					{query.isPending && <TrainingSkeleton />}
				</div>
			)}
		</div>
	)
}
