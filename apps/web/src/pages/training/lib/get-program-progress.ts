import type { WeekSummary } from './get-week-summary'

export interface ProgramWeekProgress {
	/** Days of the week that are program days and already hold a training. */
	done: number
	/** Program days in a week. */
	total: number
}

/**
 * «1 з 3 за програмою»: how many of the program's weekdays of the week got a training. Null without
 * a weekly plan (then there is nothing to count against).
 */
export const getProgramWeekProgress = (
	summary: Pick<WeekSummary, 'days'>,
	programWeekdays: ReadonlySet<number>,
): ProgramWeekProgress | null => {
	if (programWeekdays.size === 0) return null
	return {
		done: summary.days.filter((day) => day.hasTraining && programWeekdays.has(day.isoWeekday))
			.length,
		total: programWeekdays.size,
	}
}
