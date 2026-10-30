// Sentences the backend writes itself when a fact is not saved, so the model's «Запам'ятав» never
// stays in the chat next to a fact that was not stored. The user's language, gender-neutral.
import type { FactTextIssue } from './fact-guard.js'

export const FACTS_LIMIT_REPLY =
	"У пам'яті вже 30 фактів — щоб додати новий, прибери якийсь у «Пам'яті»."
export const FACT_HEALTH_REPLY = "Дані про здоров'я я не зберігаю — лише те, чого ти не їси."
export const FACT_BODY_REPLY = 'Вагу й заміри записую окремо, а не як факт.'

/** The model's reply claims the fact is remembered; any apostrophe the model may type. */
const CLAIMS_REMEMBERED = /запам['’ʼ]ятав/i

/** The notice replaces a reply that claims «запам'ятав» (it would be false); else it is added after it. */
export const applyMemoryNotice = (reply: string, notice: string): string => {
	if (CLAIMS_REMEMBERED.test(reply)) return notice
	const trimmed = reply.trim()
	return trimmed.length === 0 ? notice : `${trimmed} ${notice}`
}

/** The notice of a fact the guard refused; INSTRUCTION, EMPTY and TOO_LONG are dropped without a word. */
export const getRejectedFactNotice = (
	issue: FactTextIssue | 'EMPTY' | 'TOO_LONG',
): string | null => {
	if (issue === 'HEALTH_DATA') return FACT_HEALTH_REPLY
	if (issue === 'BODY_DATA') return FACT_BODY_REPLY
	return null
}
