import { RECIPES_PAGE_LIMIT_MAX } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { recipesQueryOptions } from '@/entities/recipe'
import { DecorBackdrop, InlineError } from '@/shared/ui'

import { RecipesEmpty } from './RecipesEmpty'
import { RecipesGrid } from './RecipesGrid'
import { RecipesHeader } from './RecipesHeader'
import { RecipesSkeleton } from './RecipesSkeleton'

// One request with the largest page: a personal list of dishes is rarely long, and the mockup has no
// «Показати ще». Past the limit the oldest recipes stay out of the list until the UI grows paging.
const RECIPES_QUERY = { limit: RECIPES_PAGE_LIMIT_MAX }

/**
 * design/docs/screens.md → Рецепти: a grid of the saved dishes and a tile that leads to the chat.
 * «Мої продукти», the search and the tabs are hidden in this iteration.
 */
export const RecipesPage = () => {
	const { t } = useTranslation()
	const query = useQuery(recipesQueryOptions(RECIPES_QUERY))
	const recipes = query.data?.data
	const isEmpty = recipes?.length === 0

	return (
		<div className="relative isolate flex flex-1 flex-col">
			{/* decor only on the empty state, as on recipes-empty */}
			{isEmpty && <DecorBackdrop />}
			<RecipesHeader />
			{recipes && recipes.length > 0 && <RecipesGrid recipes={recipes} />}
			{isEmpty && <RecipesEmpty />}
			{!recipes && query.isError && (
				<div className="px-gutter">
					<InlineError message={t('recipes.error.title')} onRetry={() => void query.refetch()} />
				</div>
			)}
			{!recipes && query.isPending && <RecipesSkeleton />}
		</div>
	)
}
