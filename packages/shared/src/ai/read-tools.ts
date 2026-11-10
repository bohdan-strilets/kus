// The registry of read tools: calls the backend answers itself and feeds back to the model before
// it writes anything (find_food, ...). Shared, so the eval can tell a read from a write the same way.

/** Most rounds of reading in one turn; a read after them is a validation error. */
export const MAX_READ_STEPS = 2
/** Most read calls of one round that run at once; the rest are not executed. */
export const MAX_PARALLEL_READS = 4

/** Names of the read tools. Empty until the first one (find_food) is added together with its schema. */
export const READ_TOOL_NAMES: ReadonlySet<string> = new Set<string>()

export const isReadToolName = (name: string): boolean => READ_TOOL_NAMES.has(name)

/** The tool result of a write call that came together with a read: it waits for the read's answer. */
export const WRITE_NOT_EXECUTED_RESULT = 'not executed: call it again after reading'
/** The tool result of a read call over the parallel limit. */
export const READ_NOT_EXECUTED_RESULT = `not executed: at most ${MAX_PARALLEL_READS} reads at a time`
/** Why a read call is rejected once reading is closed (step limit or too little time left). */
export const READ_CLOSED_ERROR =
	'reading is closed — answer now with what you have, without read calls'
