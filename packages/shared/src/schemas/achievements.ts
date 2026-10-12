import { z } from 'zod'

import { achievementTypeSchema } from './enums.js'

/** Days in a row with food logged that earn an achievement. */
export const FOOD_STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const

export const achievementResponseSchema = z.object({
	id: z.uuid(),
	type: achievementTypeSchema,
	/** Whole kg lost, or days in the streak. */
	value: z.number().int().positive(),
	achievedAt: z.iso.datetime(),
})

export type AchievementResponse = z.infer<typeof achievementResponseSchema>
