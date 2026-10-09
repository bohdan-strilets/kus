import type { LoggableMealType } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { getMealLabelKey } from '@/entities/entry'
import { Chip } from '@/shared/ui'

/** The day's course — the order of the chips. */
const MEAL_TYPES: readonly LoggableMealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']

export interface MealTypeChipsProps {
	/** undefined — none chosen yet (a meal of type OTHER). */
	value: LoggableMealType | undefined
	onChange: (value: LoggableMealType) => void
	/** The id of the text that names the group («Прийом їжі»). */
	labelId: string
}

/** Сніданок · Обід · Перекус · Вечеря, one chosen: the meal the entry belongs to. */
export const MealTypeChips = ({ value, onChange, labelId }: MealTypeChipsProps) => {
	const { t } = useTranslation()

	return (
		<div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
			{MEAL_TYPES.map((type) => (
				<Chip
					key={type}
					variant="select"
					isSelected={value === type}
					onClick={() => {
						onChange(type)
					}}
				>
					{t(getMealLabelKey(type))}
				</Chip>
			))}
		</div>
	)
}
