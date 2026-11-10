import type { ParseRefsPatch } from '@kus/shared'

export interface ReadToolCall {
	name: string
	/** The model's raw JSON arguments; the executor validates them itself. */
	arguments: string
}

export interface ReadToolContext {
	/** From the turn, never from the model's arguments: a read is always scoped to this user. */
	userId: string
	/** The user's calendar day of the turn. */
	localDate: Date
	/** The turn's deadline. */
	signal: AbortSignal
}

export interface ReadToolResult {
	/** What the model reads: a tool result, not shown to the user. */
	text: string
	/** Refs the text hands out; the loop adds them to the turn's refs before the next call. */
	refsPatch?: ParseRefsPatch
}

/**
 * Answers the read tools of READ_TOOL_NAMES. Created per turn by the module that owns the data
 * (chat): it also extends the turn's own id maps (saved foods, earlier entries) for the refsPatch
 * it returns, so a memoryRef/copyRef given after a read resolves when the decision is saved.
 * A thrown error fails the turn (AI_UNAVAILABLE); an unknown query is a `text`, not an error.
 */
export interface ReadToolExecutor {
	execute: (call: ReadToolCall, context: ReadToolContext) => Promise<ReadToolResult>
}
