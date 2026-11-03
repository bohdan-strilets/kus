import type { LiveWorkoutResponse, WorkoutFinished } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'

import { useLiveWorkout } from '@/entities/workout'
import { ROUTES } from '@/shared/config'
import { useDelayedFlag } from '@/shared/lib'
import { InlineError, Loader } from '@/shared/ui'
import { WorkoutFinishScreen } from '@/widgets/workout-finish'

import { LiveScreen } from './LiveScreen'

const LOADER_SIZE = 96

/**
 * `/app/training/live`: the open live session. No session (finished in the chat, discarded, never
 * started) leads back to the tab. The last session read stays on screen when the cache empties
 * under it — the chat closed it, and the screen says so — and the summary replaces it after
 * «Завершити», because the finished session is no longer «open».
 */
export const TrainingLivePage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const query = useLiveWorkout()
	const isLoaderShown = useDelayedFlag(query.isPending)
	const [shown, setShown] = useState<LiveWorkoutResponse | null>(null)
	const [finished, setFinished] = useState<WorkoutFinished | null>(null)
	if (query.data && query.data !== shown) setShown(query.data)

	if (finished) {
		return (
			<WorkoutFinishScreen
				finished={finished}
				onDone={() => {
					void navigate(ROUTES.training, { replace: true })
				}}
			/>
		)
	}
	const live = query.data ?? shown
	if (live) {
		return (
			<LiveScreen
				key={live.workout.id}
				live={live}
				onFinished={setFinished}
				// the cache emptied under a session that was on screen: the chat closed it
				isClosed={query.data === null}
			/>
		)
	}
	if (query.data === null) return <Navigate to={ROUTES.training} replace />
	if (query.isError) {
		return (
			<div className="px-gutter pt-8">
				<InlineError message={t('training.live.loadError')} onRetry={() => void query.refetch()} />
			</div>
		)
	}
	return (
		<div className="flex flex-1 items-center justify-center">
			{isLoaderShown && <Loader size={LOADER_SIZE} ariaLabel={t('common.loading')} />}
		</div>
	)
}
