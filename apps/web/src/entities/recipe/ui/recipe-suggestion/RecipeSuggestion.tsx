import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { type FoodCategory, FoodIcon, Icon, IconButton, Surface, Text } from '@/shared/ui'

export interface RecipeSuggestionProps {
	name: string
	kcal: number
	proteinGrams: number
	/** «Вечеря» — the meal the «+» adds it to. */
	mealLabel: string
	category: FoodCategory | null
	onAdd?: () => void
}

const PLUS_ICON_SIZE = 18

/**
 * docs Suggestion card — a recipe inside Kusik's bubble (mockups/chat.html): a white 52 tile,
 * name 14/700, «540 ккал · 52 г білка», and a 44 primary «+».
 */
export const RecipeSuggestion = ({
	name,
	kcal,
	proteinGrams,
	mealLabel,
	category,
	onAdd,
}: RecipeSuggestionProps) => {
	const { t } = useTranslation()

	return (
		<Surface variant="soft" radius="chip" shadow="none" className="flex items-center gap-3 p-2">
			<FoodIcon category={category} size="recipe" />
			<div className="flex min-w-0 flex-1 flex-col gap-px">
				<Text as="span" variant="cardTitle">
					{name}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="mutedStrong">
					{t('recipe.nutrition', {
						kcal: formatInteger(kcal),
						protein: formatInteger(proteinGrams),
					})}
				</Text>
			</div>
			<IconButton
				variant="primary"
				label={t('recipe.addToMeal', { meal: mealLabel })}
				onClick={onAdd}
			>
				<Icon name="plus" size={PLUS_ICON_SIZE} />
			</IconButton>
		</Surface>
	)
}
