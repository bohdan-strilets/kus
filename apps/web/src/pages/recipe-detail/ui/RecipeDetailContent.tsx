import type { RecipeDetail } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { DeleteRecipeButton } from '@/features/delete-recipe'
import { LogRecipePortion } from '@/features/log-recipe-portion'
import { useStartRecipeEditDraft } from '@/features/send-message'
import { ROUTES } from '@/shared/config'
import { Button, FoodIcon, Heading, ScreenHeader, Surface, Text } from '@/shared/ui'

import { RecipeComposition } from './RecipeComposition'
import { RecipeMacroTiles } from './RecipeMacroTiles'

/** «1 порція · 450 г · додано 12 разів»; a recipe never added has no second part. */
const useMetaLine = (recipe: RecipeDetail): string => {
	const { t } = useTranslation()
	const portion = t('recipes.detail.portionLine', { grams: Math.round(recipe.portionGrams) })
	if (recipe.usageCount === 0) return portion
	return t('recipes.detail.metaLine', {
		portion,
		used: t('recipes.detail.usedTimes', { count: recipe.usageCount }),
	})
}

/** design/mockups/recipe-detail.html: the dish, its figures per portion, the composition and the actions. */
export const RecipeDetailContent = ({ recipe }: { recipe: RecipeDetail }) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const metaLine = useMetaLine(recipe)
	const startEdit = useStartRecipeEditDraft()

	return (
		<>
			<ScreenHeader title={t('recipes.detail.title')} backTo={ROUTES.recipes} />
			<div className="flex flex-col gap-3 px-gutter pt-2.5 pb-5">
				<FoodIcon category={recipe.category} size="hero" />
				<div className="flex flex-col px-1">
					<Heading as="h2" level="screen">
						{recipe.name}
					</Heading>
					<Text variant="caption" weight="regular" tone="muted">
						{metaLine}
					</Text>
				</div>
				<RecipeMacroTiles recipe={recipe} />
				<RecipeComposition
					ingredients={recipe.ingredients}
					portionGrams={recipe.portionGrams}
					cookedGrams={recipe.cookedGrams}
				/>
				<Surface variant="list" radius="card" shadow="list" className="p-3">
					<LogRecipePortion recipe={recipe}>
						<Button
							variant="text"
							size="md"
							onClick={() => {
								startEdit(recipe.name)
							}}
						>
							{t('recipes.detail.editInChat')}
						</Button>
					</LogRecipePortion>
				</Surface>
				{/* not in the mockup: the delete lives at the very end, quiet, until the author decides */}
				<div className="flex justify-center">
					<DeleteRecipeButton
						recipeId={recipe.id}
						onDeleted={() => {
							void navigate(ROUTES.recipes, { replace: true })
						}}
					/>
				</div>
			</div>
		</>
	)
}
