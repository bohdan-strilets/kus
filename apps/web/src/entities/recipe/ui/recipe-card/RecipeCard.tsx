import type { RecipeListItem } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatInteger } from '@/shared/lib'
import { FoodIcon, Surface, Text } from '@/shared/ui'

export interface RecipeCardProps {
	recipe: RecipeListItem
	/** Where the card leads: `/app/recipes/:id`. */
	to: string
}

/** mockups/recipes.html: a tile with the dish icon, the name, «540 ккал · 450 г» and «12×». */
export const RecipeCard = ({ recipe, to }: RecipeCardProps) => {
	const { t } = useTranslation()

	return (
		<Surface
			variant="list"
			radius="card"
			shadow="card"
			className="flex flex-col gap-2 p-2.5 has-focus-visible:outline-3 has-focus-visible:outline-ink"
		>
			<Link to={to} className="flex flex-col gap-2 focus-visible:outline-none">
				<FoodIcon category={recipe.category} size="card" />
				<Text as="span" variant="cardTitle" weight="bold" className="leading-tight">
					{recipe.name}
				</Text>
				<span className="flex justify-between">
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('recipes.card.nutrition', {
							kcal: formatInteger(recipe.kcal),
							grams: formatInteger(recipe.portionGrams),
						})}
					</Text>
					<Text as="span" variant="small" weight="regular" tone="muted">
						{t('recipes.card.usage', { count: recipe.usageCount })}
					</Text>
				</span>
			</Link>
		</Surface>
	)
}
