import type { LoggedMeal } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { getMealCategory, getMealLabelKey, MealRow } from '@/entities/entry'
import { formatTime } from '@/shared/lib'

import { getMealSummary } from '../lib/get-meal-summary'

/** The day's meals in their course (the API orders them): icon, «Сніданок 08:40», what, kcal. */
export const MealsList = ({ meals }: { meals: readonly LoggedMeal[] }) => {
	const { t } = useTranslation()

	return (
		<ul className="flex flex-col gap-2">
			{meals.map((meal) => (
				<li key={meal.id}>
					<MealRow
						mealLabel={t(getMealLabelKey(meal.type))}
						time={formatTime(new Date(meal.eatenAt))}
						summary={getMealSummary(meal.entries)}
						kcal={meal.totals.kcal}
						category={getMealCategory(meal.entries)}
					/>
				</li>
			))}
		</ul>
	)
}
