import { exerciseStatsParamsSchema, type WorkoutStatsPeriod } from '@kus/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { exerciseStatsQueryOptions, PeriodToggle } from '@/entities/workout'
import { getApiError, HTTP_STATUS } from '@/shared/api'
import { TRAINING_STATS_ROUTE } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { formatExerciseSubtitle } from '../lib/exercise-view'
import { DEFAULT_EXERCISE_PERIOD } from '../lib/training-exercise.constants'
import { ExerciseContent } from './ExerciseContent'
import { ExerciseNotFound } from './ExerciseNotFound'
import { ExerciseSkeleton } from './ExerciseSkeleton'

const NotFoundScreen = () => {
	const { t } = useTranslation()
	return (
		<>
			<ScreenHeader title={t('pages.trainingStats.title')} backTo={TRAINING_STATS_ROUTE} />
			<ExerciseNotFound />
		</>
	)
}

/**
 * design/mockups/training-stats.html «Екран вправи»: one exercise over a period. The period is the
 * screen's own (a month at first), not taken from the stats list. `:id` is the exercise id.
 */
export const TrainingExercisePage = () => {
	const { id = '' } = useParams()
	// an id that is no uuid is the same as an unknown one: no request, the API would answer 422
	const params = exerciseStatsParamsSchema.safeParse({ exerciseId: id })
	return params.success ? (
		<TrainingExerciseScreen key={params.data.exerciseId} exerciseId={params.data.exerciseId} />
	) : (
		<NotFoundScreen />
	)
}

const TrainingExerciseScreen = ({ exerciseId }: { exerciseId: string }) => {
	const { t } = useTranslation()
	const [period, setPeriod] = useState<WorkoutStatsPeriod>(DEFAULT_EXERCISE_PERIOD)
	// the previous period stays on screen while the new one loads
	const query = useQuery({
		...exerciseStatsQueryOptions(exerciseId, period),
		placeholderData: keepPreviousData,
	})
	const { data } = query
	const apiError = query.isError ? getApiError(query.error) : null
	if (!data && apiError?.kind === 'http' && apiError.status === HTTP_STATUS.notFound)
		return <NotFoundScreen />

	const renderBody = () => {
		if (data) return <ExerciseContent data={data} />
		return apiError ? (
			<InlineError
				message={t('training.stats.exercise.loadError')}
				onRetry={() => void query.refetch()}
			/>
		) : (
			<ExerciseSkeleton />
		)
	}

	return (
		<>
			<ScreenHeader
				title={data ? data.exercise.name : t('pages.trainingStats.title')}
				subtitle={data ? formatExerciseSubtitle(data, t) : undefined}
				backTo={TRAINING_STATS_ROUTE}
			/>
			<div className="flex flex-col gap-2.5 px-gutter pb-4">
				<PeriodToggle value={period} onChange={setPeriod} />
				{renderBody()}
			</div>
		</>
	)
}
