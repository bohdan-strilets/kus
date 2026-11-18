import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

export interface RecipeIngredientRowProps {
	name: string
	grams: number
	kcal: number
}

/** mockups/recipe-detail.html «Склад»: «Куряче філе · 200 г» and the kcal on the right. */
export const RecipeIngredientRow = ({ name, grams, kcal }: RecipeIngredientRowProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex items-baseline justify-between border-b border-line px-3.5 py-2.5 last:border-b-0">
			<Text as="span" variant="body" weight="semibold">
				{name}{' '}
				<Text as="span" variant="body" weight="medium" tone="muted">
					{t('recipes.detail.ingredientGrams', { grams: formatInteger(grams) })}
				</Text>
			</Text>
			<Text as="span" variant="caption" weight="bold" className="tabular-nums">
				{formatInteger(kcal)}
			</Text>
		</div>
	)
}
