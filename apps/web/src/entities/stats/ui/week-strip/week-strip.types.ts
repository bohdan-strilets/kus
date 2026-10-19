import type { DayStatus } from '@kus/shared'

/** normal — within the goal (success dot); over — over it (over dot); empty — nothing logged. */
export type { DayStatus }

/** `planned` — food written ahead for a day after today (a ring, never «over»). */
export type WeekDayStatus = DayStatus | 'planned'

export interface WeekDay {
	date: Date
	status: WeekDayStatus
	/** A day after today: it gets a thin frame and «заплановано» / «нічого не записано» labels. */
	isUpcoming?: boolean
}
