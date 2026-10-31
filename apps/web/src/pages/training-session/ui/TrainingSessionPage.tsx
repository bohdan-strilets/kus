import { workoutParamsSchema } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { workoutQueryOptions } from '@/entities/workout'
import { getApiError, HTTP_STATUS } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { SessionContent } from './SessionContent'
import { SessionNotFound } from './SessionNotFound'
import { SessionSkeleton } from './SessionSkeleton'

/** The screen is still without a training: the header says only where we are. */
const PlaceholderHeader = () => {
	const { t } = useTranslation()
	return <ScreenHeader title={t('pages.training.title')} backTo={ROUTES.training} />
}

/** design/mockups/training-session.html: one training by its groups. `:id` is the workout id. */
export const TrainingSessionPage = () => {
	const { id = '' } = useParams()
	// an id that is no uuid is the same as an unknown one: no request, the API would answer 422
	const params = workoutParamsSchema.safeParse({ id })
	return params.success ? <TrainingSessionScreen workoutId={params.data.id} /> : <NotFoundScreen />
}

const NotFoundScreen = () => (
	<>
		<PlaceholderHeader />
		<SessionNotFound />
	</>
)

const TrainingSessionScreen = ({ workoutId }: { workoutId: string }) => {
	const { t } = useTranslation()
	const query = useQuery(workoutQueryOptions(workoutId))
	// a failed refetch keeps the training already shown; the error is only for an empty screen
	if (query.data) return <SessionContent workout={query.data} />

	const apiError = query.isError ? getApiError(query.error) : null
	if (apiError?.kind === 'http' && apiError.status === HTTP_STATUS.notFound)
		return <NotFoundScreen />

	return (
		<>
			<PlaceholderHeader />
			<div className="flex flex-col px-gutter pb-4">
				{apiError ? (
					<InlineError message={t('training.loadError')} onRetry={() => void query.refetch()} />
				) : (
					<SessionSkeleton />
				)}
			</div>
		</>
	)
}
