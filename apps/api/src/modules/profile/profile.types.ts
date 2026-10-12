import type { GoalType } from '../../generated/prisma/client'

/** «Вага зараз» as the profile reads it: the latest weight and its calendar day. */
export interface LatestWeight {
	value: number
	localDate: Date
}

/** The profile's weight plan; every field is null until the user sets it. */
export interface WeightGoal {
	goalType: GoalType | null
	targetWeightKg: number | null
	paceKgPerWeek: number | null
}
