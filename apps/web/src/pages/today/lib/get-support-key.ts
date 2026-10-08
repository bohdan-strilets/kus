/** Up to about a sandwich the comparison is honest (mockups/today-over.html); above — just «буває». */
export const SMALL_OVER_KCAL = 300

export type SupportKey = 'today.support.small' | 'today.support.large'

/** Kusik's line under the meals of a day over the goal: no reproach, no numbers to «work off». */
export const getSupportKey = (overKcal: number): SupportKey =>
	overKcal <= SMALL_OVER_KCAL ? 'today.support.small' : 'today.support.large'
