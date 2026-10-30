import type { MyFoodResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { FoodIcon, Icon, ICON_SIZE, Text } from '@/shared/ui'

import { formatMyFoodLine } from '../../lib/format-my-food-line'

interface MyFoodRowProps {
	food: MyFoodResponse
	onSelect: (food: MyFoodResponse) => void
}

/** mockups/memory-products.html: the icon, the name, the «100 г — …» line and the pencil; the whole row is the button. */
export const MyFoodRow = ({ food, onSelect }: MyFoodRowProps) => {
	const { t } = useTranslation()

	return (
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={t('memory.products.rowLabel', { name: food.name })}
			onClick={() => {
				onSelect(food)
			}}
			className="flex min-h-15 w-full items-center gap-3 px-3.5 py-2 text-left focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink"
		>
			<FoodIcon category={food.category} size="meal" />
			<span className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="cardTitle" weight="semibold" className="truncate">
					{food.name}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted" className="truncate">
					{formatMyFoodLine(food, t)}
				</Text>
			</span>
			<span className="flex size-11 shrink-0 items-center justify-center text-muted">
				<Icon name="edit" size={ICON_SIZE.control} />
			</span>
		</button>
	)
}
