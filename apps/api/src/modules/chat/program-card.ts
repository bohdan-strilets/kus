import { type ProgramCard, programCardSchema } from '@kus/shared'

export interface StoredProgramCard {
	card: ProgramCard | null
	/** true when something was stored but no longer reads as a program card. */
	isUnreadable: boolean
}

/** The card as stored in `messages.program_card`; a value that doesn't parse reads as no card. */
export const readStoredProgramCard = (value: unknown): StoredProgramCard => {
	if (value === null || value === undefined) return { card: null, isUnreadable: false }
	const parsed = programCardSchema.safeParse(value)
	return parsed.success
		? { card: parsed.data, isUnreadable: false }
		: { card: null, isUnreadable: true }
}
