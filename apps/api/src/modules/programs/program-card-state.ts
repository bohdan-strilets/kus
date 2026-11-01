import type { ProgramCardState } from '@kus/shared'

export interface CardStateInput {
	messageId: string
	baseVersionId: string | null
	/** The version accepted from this card; null when there is none. */
	acceptedAt: Date | null
	/** The user's newest message with a program card. */
	newestCardMessageId: string | null
	/** The live program's active version; null without a program (or once it is removed). */
	activeVersionId: string | null
}

/** Accepted first, then replaced by a newer card, then outdated by a program that moved on. */
export const deriveProgramCardState = ({
	messageId,
	baseVersionId,
	acceptedAt,
	newestCardMessageId,
	activeVersionId,
}: CardStateInput): ProgramCardState => {
	if (acceptedAt !== null) {
		return { status: 'ACCEPTED', versionCreatedAt: acceptedAt.toISOString() }
	}
	if (newestCardMessageId !== messageId) return { status: 'REPLACED', versionCreatedAt: null }
	if (baseVersionId !== activeVersionId) return { status: 'OUTDATED', versionCreatedAt: null }
	return { status: 'OPEN', versionCreatedAt: null }
}
