import type { FoodParseDecision } from '@kus/shared'

import type { LoggedProgram } from './eval.types.js'

/** The program of a propose_program answer; null for any other decision. */
export const getLoggedProgram = (decision: FoodParseDecision): LoggedProgram | null => {
	if (decision.kind !== 'program') return null
	const { mode, pinnedRef, templates } = decision.program
	return {
		mode,
		pinnedRef,
		templates: templates.map((template) => ({
			ref: template.ref,
			name: template.name,
			weekdays: template.weekdays,
			exercises: template.exercises.map(({ name, weightKg }) => ({ name, weightKg })),
		})),
	}
}
