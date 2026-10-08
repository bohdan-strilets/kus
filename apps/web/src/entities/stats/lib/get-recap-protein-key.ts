/** From this share of the protein goal the day reads «майже в цілі». */
const NEAR_GOAL_SHARE = 0.9

export type RecapProteinKey =
	| 'chat.dayRecap.proteinNoGoal'
	| 'chat.dayRecap.protein'
	| 'chat.dayRecap.proteinNearGoal'
	| 'chat.dayRecap.proteinAtGoal'

/** «Білок 131 г з 140 — майже в цілі»: 90–99 % of the goal is «майже», 100 %+ is «в цілі». */
export const getRecapProteinKey = (protein: number, goal: number | null): RecapProteinKey => {
	if (goal === null || goal <= 0) return 'chat.dayRecap.proteinNoGoal'
	const share = protein / goal
	if (share >= 1) return 'chat.dayRecap.proteinAtGoal'
	if (share >= NEAR_GOAL_SHARE) return 'chat.dayRecap.proteinNearGoal'
	return 'chat.dayRecap.protein'
}
