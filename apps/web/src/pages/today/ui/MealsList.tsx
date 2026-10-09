import type { LoggedMeal } from '@kus/shared'

import { useEditEntryStore } from '@/features/edit-entry'

import { useCollapsedMealsStore } from '../model/collapsed-meals-store'
import { MealSection } from './MealSection'

/** The day's meals in their course (the API orders them), each open on its lines unless folded. */
export const MealsList = ({ meals }: { meals: readonly LoggedMeal[] }) => {
	const collapsedIds = useCollapsedMealsStore((state) => state.collapsedIds)
	const toggle = useCollapsedMealsStore((state) => state.toggle)
	const openEditor = useEditEntryStore((state) => state.open)

	return (
		<ul className="flex flex-col gap-2">
			{meals.map((meal) => (
				<li key={meal.id}>
					<MealSection
						meal={meal}
						isExpanded={!collapsedIds[meal.id]}
						onToggle={() => {
							toggle(meal.id)
						}}
						onEditEntry={(entryId) => {
							openEditor({ meal, entryId })
						}}
					/>
				</li>
			))}
		</ul>
	)
}
