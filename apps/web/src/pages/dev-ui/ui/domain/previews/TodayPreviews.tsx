import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getMealCategory, MealRow } from '@/entities/entry'
import { RecipeTip } from '@/entities/recipe'
import { DayStatsCard, type MacroProgressSet, SupportCard, WeekStrip } from '@/entities/stats'

import {
	SEED_EATEN_KCAL,
	SEED_GOAL_KCAL,
	SEED_MACROS,
	SEED_MEALS,
	SEED_OVER_EATEN_KCAL,
	SEED_OVER_MACROS,
	SEED_RECIPE,
	SEED_TODAY,
	SEED_WEEK,
} from '../../../model/seed'
import { TodayPreviewHeader } from '../PreviewHeaders'
import { PreviewFrame } from './PreviewFrame'

const TodayTop = ({ eaten, macros }: { eaten: number; macros: MacroProgressSet }) => {
	const [selectedDate, setSelectedDate] = useState(SEED_TODAY)

	return (
		<>
			<TodayPreviewHeader />
			<div className="flex flex-col gap-2.5 px-gutter">
				<WeekStrip days={SEED_WEEK} selectedDate={selectedDate} onSelect={setSelectedDate} />
				<DayStatsCard eaten={eaten} goal={SEED_GOAL_KCAL} macros={macros} />
			</div>
		</>
	)
}

const DayMeals = () => {
	const { t } = useTranslation()

	return (
		<>
			<MealRow
				mealLabel={t('meal.breakfast')}
				time={SEED_MEALS.breakfast.time}
				summary={t('devUi.seed.breakfastSummary')}
				kcal={SEED_MEALS.breakfast.kcal}
				category={getMealCategory(SEED_MEALS.breakfast.entries)}
			/>
			<MealRow
				mealLabel={t('meal.lunch')}
				time={SEED_MEALS.lunch.time}
				summary={t('devUi.seed.lunchSummary')}
				kcal={SEED_MEALS.lunch.kcal}
				category={getMealCategory(SEED_MEALS.lunch.entries)}
			/>
			<MealRow
				mealLabel={t('meal.snack')}
				time={SEED_MEALS.snack.time}
				summary={t('devUi.seed.snackSummary')}
				kcal={SEED_MEALS.snack.kcal}
				category={getMealCategory(SEED_MEALS.snack.entries)}
			/>
		</>
	)
}

/** today and today-over assembled from the real components and seed data. */
export const TodayPreviews = () => {
	const { t } = useTranslation()

	return (
		<>
			<PreviewFrame mockup="today">
				<TodayTop eaten={SEED_EATEN_KCAL} macros={SEED_MACROS} />
				<div className="mt-2.5 flex flex-col gap-2 px-gutter">
					<DayMeals />
					<RecipeTip
						mealLabel={t('meal.dinner')}
						recipeName={t('devUi.seed.recipeNameLower')}
						kcal={SEED_RECIPE.kcal}
					/>
				</div>
			</PreviewFrame>

			<PreviewFrame mockup="today-over">
				<TodayTop eaten={SEED_OVER_EATEN_KCAL} macros={SEED_OVER_MACROS} />
				<div className="mt-2.5 flex flex-col gap-2 px-gutter">
					<DayMeals />
					<MealRow
						mealLabel={t('meal.dinner')}
						time={SEED_MEALS.dinner.time}
						summary={t('devUi.seed.dinnerSummary')}
						kcal={SEED_MEALS.dinner.kcal}
						category={getMealCategory(SEED_MEALS.dinner.entries)}
					/>
					<SupportCard message={t('devUi.seed.supportMessage')} />
				</div>
			</PreviewFrame>
		</>
	)
}
