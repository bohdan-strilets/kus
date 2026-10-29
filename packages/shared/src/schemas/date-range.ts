const MS_IN_DAY = 24 * 60 * 60 * 1000

/** Days from `from` to `to`, both included. */
export const countRangeDays = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_IN_DAY) + 1
