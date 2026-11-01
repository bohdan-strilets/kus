import type { ProgramLastSet, TemplateExerciseDraft } from '@kus/shared'

/** An exercise of the template being edited: the request's shape plus what the screen needs. */
export interface DraftExercise extends TemplateExerciseDraft {
	/** Stable while the row lives: the program's row id, or a new one for an added exercise. */
	key: string
	/** The last time the user did it, for «Минулого разу»; null when never or unknown. */
	lastSets: ProgramLastSet[] | null
}
