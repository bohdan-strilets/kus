import type { ProgramResponse } from '@kus/shared'

/** The ISO weekdays a program names: only the mode «За днями тижня» ties trainings to days. */
export const getProgramWeekdays = (program: ProgramResponse | null | undefined): Set<number> =>
	new Set(
		program?.mode === 'WEEKDAYS' ? program.templates.flatMap((template) => template.weekdays) : [],
	)
