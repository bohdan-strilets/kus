import type { ProgressResponse } from '@kus/shared'

/** Tests only: the mockup's month — 84,0 to 82,4, a week ending on Monday 2026-10-12. */
export const makeProgress = (overrides: Partial<ProgressResponse> = {}): ProgressResponse => ({
	range: 30,
	from: '2026-09-13',
	to: '2026-10-12',
	isEmpty: false,
	weight: {
		current: { value: 82.4, localDate: '2026-10-12' },
		changeInRange: -1.6,
		changeSince: null,
		points: [
			{ localDate: '2026-09-13', value: 84 },
			{ localDate: '2026-09-28', value: 83.2 },
			{ localDate: '2026-10-12', value: 82.4 },
		],
		target: 78,
		toGoal: 4.4,
		isGoalReached: false,
		start: { value: 84, localDate: '2026-09-13' },
		fromStart: -1.6,
	},
	waist: null,
	week: {
		days: [
			{ localDate: '2026-10-06', kcal: 2100, proteinG: 120, status: 'normal' },
			{ localDate: '2026-10-07', kcal: 2400, proteinG: 130, status: 'over' },
			{ localDate: '2026-10-08', kcal: 2000, proteinG: 118, status: 'normal' },
			{ localDate: '2026-10-09', kcal: 2150, proteinG: 126, status: 'normal' },
			{ localDate: '2026-10-10', kcal: 2420, proteinG: 110, status: 'over' },
			{ localDate: '2026-10-11', kcal: 2200, proteinG: 124, status: 'normal' },
			{ localDate: '2026-10-12', kcal: 1370, proteinG: 80, status: 'normal' },
		],
		goalKcal: 2200,
		avgKcal: 2195,
		avgProteinG: 124,
	},
	insight: {
		weekPaceKg: -0.4,
		planPaceKgPerWeek: 0.5,
		goalType: 'LOSE',
		overDays: 2,
		isWeekendProteinLow: true,
	},
	...overrides,
})
