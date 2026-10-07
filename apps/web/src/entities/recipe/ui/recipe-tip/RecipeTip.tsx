import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { HamsterHead, Icon, IconButton, Surface, Text } from '@/shared/ui'

export interface RecipeTipProps {
	/** «Вечеря» — the meal still to come. */
	mealLabel: string
	recipeName: string
	kcal: number
	onAdd?: () => void
}

const HEAD_SIZE = 44
const PLUS_ICON_SIZE = 18

/**
 * The tip for the next meal under the «Сьогодні» list (mockups/today.html): a dashed card, the
 * hungry head, «Порада: курка з гречкою · 540» and a primary «+».
 */
export const RecipeTip = ({ mealLabel, recipeName, kcal, onAdd }: RecipeTipProps) => {
	const { t } = useTranslation()

	return (
		<Surface
			variant="dashed"
			radius="bubble"
			shadow="none"
			className="flex items-center gap-3 p-2.5"
		>
			<HamsterHead mood="hungry" size={HEAD_SIZE} />
			<div className="flex min-w-0 flex-1 flex-col gap-px">
				<Text as="span" weight="bold">
					{mealLabel}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted">
					{t('recipe.dinnerTip', { name: recipeName, kcal: formatInteger(kcal) })}
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
