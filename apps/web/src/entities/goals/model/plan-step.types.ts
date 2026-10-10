import type { ActivityLevel, GoalsPreviewResponse, GoalType, Sex } from '@kus/shared'

export interface PlanStep {
	title: string
	formula: string
	value: string
}

/** The profile narrowed to what the calculation needs; the page checks for nulls before this. */
export interface PlanProfile {
	sex: Sex
	age: number
	heightCm: number
	weightKg: number
	activityLevel: ActivityLevel
	goalType: GoalType
	paceKgPerWeek: number | null
}

export interface PlanStepsInput {
	preview: GoalsPreviewResponse
	profile: PlanProfile
}
