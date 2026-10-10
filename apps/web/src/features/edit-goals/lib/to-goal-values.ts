import type { DailyGoal, ProfileGoals } from '@kus/shared'

/** The four numbers the sheet starts from, whichever side they come from (the day or the profile). */
export interface GoalValues {
	kcal: number
	protein: number
	carbs: number
	fat: number
}

const isProfileGoals = (goal: DailyGoal | ProfileGoals): goal is ProfileGoals => 'proteinG' in goal

export const toGoalValues = (goal: DailyGoal | ProfileGoals | null): GoalValues | null => {
	if (goal === null) return null
	if (isProfileGoals(goal)) {
		return { kcal: goal.kcal, protein: goal.proteinG, carbs: goal.carbsG, fat: goal.fatG }
	}
	return { kcal: goal.kcal, protein: goal.protein, carbs: goal.carbs, fat: goal.fat }
}
