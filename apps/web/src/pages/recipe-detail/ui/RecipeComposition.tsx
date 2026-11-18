import type { RecipeDetail } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { RecipeIngredientRow } from '@/entities/recipe'
import { Surface, Text } from '@/shared/ui'

interface RecipeCompositionProps {
	ingredients: RecipeDetail['ingredients']
	portionGrams: number
	cookedGrams: number
}

/** mockups/recipe-detail.html «Склад»: a card with the ingredients and the kcal of each. */
export const RecipeComposition = ({
	ingredients,
	portionGrams,
	cookedGrams,
}: RecipeCompositionProps) => {
	const { t } = useTranslation()
	// the whole-dish weight is only news when the portion is not the whole dish
	const hasWholeDishLabel = Math.round(portionGrams) !== Math.round(cookedGrams)

	return (
		<Surface as="section" variant="list" radius="card" shadow="list" className="overflow-hidden">
			<div className="flex items-baseline justify-between gap-2 px-3.5 pt-3 pb-1">
				<Text as="p" role="heading" aria-level={3} variant="eyebrow" tone="muted">
					{t('recipes.detail.ingredients')}
				</Text>
				{hasWholeDishLabel && (
					<Text as="p" variant="caption" weight="regular" tone="muted">
						{t('recipes.detail.wholeDish', { grams: Math.round(cookedGrams) })}
					</Text>
				)}
			</div>
			{ingredients.map((ingredient) => (
				<RecipeIngredientRow
					key={ingredient.id}
					name={ingredient.name}
					grams={ingredient.grams}
					kcal={ingredient.kcal}
				/>
			))}
		</Surface>
	)
}
