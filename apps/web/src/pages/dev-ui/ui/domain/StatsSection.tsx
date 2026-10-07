import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MealRow } from '@/entities/entry'
import { RecipeTip } from '@/entities/recipe'
import {
	CalorieGauge,
	CompactDayBar,
	DayStatsCard,
	DaySummaryCard,
	MacroTiles,
	SupportCard,
	WeekStrip,
} from '@/entities/stats'
import { Surface, Text } from '@/shared/ui'

import {
	SEED_EATEN_KCAL,
	SEED_FAR_OVER_EATEN_KCAL,
	SEED_GOAL_KCAL,
	SEED_MACROS,
	SEED_MEALS,
	SEED_OVER_EATEN_KCAL,
	SEED_OVER_MACROS,
	SEED_RECIPE,
	SEED_TODAY,
	SEED_WEEK,
} from '../../model/seed'
import { DevSection } from '../DevSection'

// the four states of mockups/brand-calorie-ring-states.html
const GAUGE_STATES = [
	SEED_EATEN_KCAL,
	SEED_GOAL_KCAL,
	SEED_OVER_EATEN_KCAL,
	SEED_FAR_OVER_EATEN_KCAL,
] as const

export const StatsSection = () => {
	const { t } = useTranslation()
	const [selectedDate, setSelectedDate] = useState(SEED_TODAY)

	return (
		<>
			<DevSection title={t('devUi.sections.gaugeStates')}>
				<div className="grid grid-cols-2 gap-3">
					{GAUGE_STATES.map((eaten) => (
						<Surface key={eaten} radius="tile" className="flex flex-col items-center gap-3 py-4">
							<CalorieGauge eaten={eaten} goal={SEED_GOAL_KCAL} size="compact" />
						</Surface>
					))}
				</div>
				{GAUGE_STATES.map((eaten) => (
					<Surface key={eaten} radius="tile" className="flex justify-center py-4">
						<CalorieGauge eaten={eaten} goal={SEED_GOAL_KCAL} />
					</Surface>
				))}
			</DevSection>

			<DevSection title={t('devUi.sections.stats')}>
				<DaySummaryCard eaten={SEED_EATEN_KCAL} goal={SEED_GOAL_KCAL} macros={SEED_MACROS} />
				<div className="flex">
					<CompactDayBar
						eaten={SEED_EATEN_KCAL}
						goal={SEED_GOAL_KCAL}
						protein={SEED_MACROS.protein}
					/>
				</div>
				<MacroTiles macros={SEED_MACROS} variant="compact" />
				<MacroTiles macros={SEED_OVER_MACROS} />
				<WeekStrip days={SEED_WEEK} selectedDate={selectedDate} onSelect={setSelectedDate} />
				<DayStatsCard eaten={SEED_EATEN_KCAL} goal={SEED_GOAL_KCAL} macros={SEED_MACROS} />
				<MealRow
					mealLabel={t('meal.breakfast')}
					time={SEED_MEALS.breakfast.time}
					summary={t('devUi.seed.breakfastSummary')}
					kcal={SEED_MEALS.breakfast.kcal}
					icon="egg"
				/>
				<MealRow
					mealLabel={t('meal.snack')}
					time={SEED_MEALS.snack.time}
					summary={t('devUi.seed.unknownFood')}
					kcal={SEED_MEALS.snack.kcal}
				/>
				<RecipeTip
					mealLabel={t('meal.dinner')}
					recipeName={t('devUi.seed.recipeNameLower')}
					kcal={SEED_RECIPE.kcal}
				/>
				<SupportCard message={t('devUi.seed.supportMessage')} />
				<Text variant="caption" tone="muted">
					{t('devUi.seed.supportAvatarMissing')}
				</Text>
			</DevSection>
		</>
	)
}
