/** Neutral for any message — a question or food — until real stages come with SSE (docs/architecture.md). */
export type WaitingPhraseKey =
	'chat.waiting.thinking' | 'chat.waiting.second' | 'chat.waiting.almost' | 'chat.waiting.long'

export const WAITING_PHRASE_STEP_MS = 2500
/** From here the answer is a long one (a whole day): say why it takes a while. */
export const WAITING_LONG_MS = 8000

const STEPS: readonly WaitingPhraseKey[] = [
	'chat.waiting.thinking',
	'chat.waiting.second',
	'chat.waiting.almost',
]

export const getWaitingPhraseKey = (elapsedMs: number): WaitingPhraseKey => {
	if (elapsedMs >= WAITING_LONG_MS) return 'chat.waiting.long'
	const step = Math.min(Math.floor(elapsedMs / WAITING_PHRASE_STEP_MS), STEPS.length - 1)
	return STEPS[step] ?? 'chat.waiting.thinking'
}
