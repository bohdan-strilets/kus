export const PROGRESS_STEPS = [0.25, 0.5, 0.8] as const

/** Prints cumulative spend once when it first reaches each step of the effective cap. */
export const createProgressReporter = (
	capUsd: number,
	print: (text: string) => void,
): ((spentUsd: number) => void) => {
	const reported = new Set<number>()
	return (spentUsd) => {
		for (const step of PROGRESS_STEPS) {
			if (reported.has(step) || spentUsd < step * capUsd) continue
			reported.add(step)
			print(
				`  ${Math.round(step * 100)} % ліміту: витрачено $${spentUsd.toFixed(4)} з $${capUsd.toFixed(2)}`,
			)
		}
	}
}
