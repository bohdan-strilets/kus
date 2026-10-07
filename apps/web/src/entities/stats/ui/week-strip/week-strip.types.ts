/** normal — within the goal (success dot); over — over it (over dot); empty — nothing logged. */
export type DayStatus = 'normal' | 'over' | 'empty'

export interface WeekDay {
	date: Date
	status: DayStatus
}
