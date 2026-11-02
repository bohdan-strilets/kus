export interface BodyWeightMeasurement {
	/** `YYYY-MM-DD` */
	localDate: string
	value: number
}

/**
 * The body weight for a workout day: the last weigh-in on or before the day, else the first one
 * after it, else null. The list may come in any order.
 */
export const pickBodyWeight = (
	measurements: readonly BodyWeightMeasurement[],
	localDate: string,
): number | null => {
	let before: BodyWeightMeasurement | null = null
	let after: BodyWeightMeasurement | null = null
	for (const measurement of measurements) {
		if (measurement.localDate <= localDate) {
			if (!before || measurement.localDate > before.localDate) before = measurement
		} else if (!after || measurement.localDate < after.localDate) {
			after = measurement
		}
	}
	return (before ?? after)?.value ?? null
}
