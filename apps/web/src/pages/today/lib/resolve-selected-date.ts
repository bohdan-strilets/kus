const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

/** `?date=` of the screen: a real past day, else today (a typo or a future day shows today). */
export const resolveSelectedDate = (param: string | null, today: string): string => {
	if (param === null || !LOCAL_DATE.test(param)) return today
	const parsed = new Date(`${param}T00:00:00Z`)
	// 2026-02-31 parses into March: only a date that reads back the same is real
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== param) return today
	return param > today ? today : param
}
