import { recipeParamsSchema } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { recipeQueryOptions } from '@/entities/recipe'
import { getApiError, HTTP_STATUS } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { RecipeDetailContent } from './RecipeDetailContent'
import { RecipeDetailSkeleton } from './RecipeDetailSkeleton'
import { RecipeNotFound } from './RecipeNotFound'

/** The header while there is no recipe to name: only where we are. */
const PlaceholderHeader = () => {
	const { t } = useTranslation()
	return <ScreenHeader title={t('recipes.detail.title')} backTo={ROUTES.recipes} />
}

/** design/mockups/recipe-detail.html: one recipe. `:id` is the recipe id. */
export const RecipeDetailPage = () => {
	const { id = '' } = useParams()
	// an id that is no uuid is the same as an unknown one: no request, the API would answer 422
	const params = recipeParamsSchema.safeParse({ id })
	return params.success ? <RecipeDetailScreen recipeId={params.data.id} /> : <NotFoundScreen />
}

const NotFoundScreen = () => (
	<>
		<PlaceholderHeader />
		<RecipeNotFound />
	</>
)

const RecipeDetailScreen = ({ recipeId }: { recipeId: string }) => {
	const { t } = useTranslation()
	const query = useQuery(recipeQueryOptions(recipeId))
	// a failed refetch keeps the recipe already shown; the error is only for an empty screen
	if (query.data) return <RecipeDetailContent recipe={query.data} />

	const apiError = query.isError ? getApiError(query.error) : null
	if (apiError?.kind === 'http' && apiError.status === HTTP_STATUS.notFound) {
		return <NotFoundScreen />
	}

	return (
		<>
			<PlaceholderHeader />
			<div className="flex flex-col px-gutter pt-2.5 pb-5">
				{apiError ? (
					<InlineError message={t('recipes.error.title')} onRetry={() => void query.refetch()} />
				) : (
					<RecipeDetailSkeleton />
				)}
			</div>
		</>
	)
}
