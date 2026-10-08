import type { DayStatus } from '@kus/shared'

/** normal — within the goal (success dot); over — over it (over dot); empty — nothing logged. */
export type { DayStatus }

export interface WeekDay {
	date: Date
	status: DayStatus
}
