// Sentences the backend writes itself when a fact is not saved, so the model's «Запам'ятав» never
// stays in the chat next to a fact that was not stored. The user's language, gender-neutral.
import { FACTS_MAX } from '../schemas/facts.js'
import type { FactTextIssue } from './fact-guard.js'

export const FACTS_LIMIT_REPLY = `У пам'яті вже ${FACTS_MAX} фактів — щоб додати новий, прибери якийсь у «Пам'яті».`
export const FACT_HEALTH_REPLY = "Дані про здоров'я я не зберігаю — лише те, чого ти не їси."
export const FACT_BODY_REPLY = 'Вагу й заміри записую окремо, а не як факт.'
export const FACT_TOO_LONG_REPLY = "Це задовго для пам'яті — скажи одним коротким реченням."
export const FACT_NOT_SAVED_REPLY = "Цього я не запам'ятав."
export const FOOD_RESTORE_NAME_TAKEN_REPLY =
	"Під цією назвою в пам'яті вже є інший продукт — повернути цей не вийшло."
export const FOOD_RESTORE_GONE_REPLY = 'Цей продукт уже не повернути.'
export const FOOD_REMOVE_FAILED_REPLY = 'Не вдалося прибрати цей продукт — спробуй ще раз.'
export const FOOD_RESTORE_FAILED_REPLY = 'Не вдалося повернути цей продукт — спробуй ще раз.'

export interface MemoryNotice {
	text: string
	/** Said only to correct a reply that claims «запам'ятав»; otherwise the refusal stays silent. */
	isQuietUnlessClaimed: boolean
	/** The reply is about the very thing that did not happen, so the notice stands instead of it. */
	isReplacing?: boolean
}

export const FACTS_LIMIT_NOTICE: MemoryNotice = {
	text: FACTS_LIMIT_REPLY,
	isQuietUnlessClaimed: false,
}

/** A restore_food that did not bring the food back: said even when the model claims it did. */
export const FOOD_RESTORE_NAME_TAKEN_NOTICE: MemoryNotice = {
	text: FOOD_RESTORE_NAME_TAKEN_REPLY,
	isQuietUnlessClaimed: false,
	isReplacing: true,
}

export const FOOD_RESTORE_GONE_NOTICE: MemoryNotice = {
	text: FOOD_RESTORE_GONE_REPLY,
	isQuietUnlessClaimed: false,
	isReplacing: true,
}

/** A forget_food the backend did not carry out (a stale ref, the question expired): the «Видалив» would be false. */
export const FOOD_REMOVE_FAILED_NOTICE: MemoryNotice = {
	text: FOOD_REMOVE_FAILED_REPLY,
	isQuietUnlessClaimed: false,
	isReplacing: true,
}

/** A restore_food whose ref is not known (a stale request): the «Повернув» would be false. */
export const FOOD_RESTORE_FAILED_NOTICE: MemoryNotice = {
	text: FOOD_RESTORE_FAILED_REPLY,
	isQuietUnlessClaimed: false,
	isReplacing: true,
}

/** The model's reply claims the fact is remembered; any apostrophe the model may type. */
const CLAIMS_REMEMBERED = /запам['’ʼ]ятав/i

/**
 * A reply that claims «запам'ятав» is replaced by the notice (it would be false); otherwise the
 * notice is added after it, or — for a quiet one — the reply stays as it is.
 */
export const applyMemoryNotice = (reply: string, notice: MemoryNotice): string => {
	if (notice.isReplacing || CLAIMS_REMEMBERED.test(reply)) return notice.text
	if (notice.isQuietUnlessClaimed) return reply
	const trimmed = reply.trim()
	return trimmed.length === 0 ? notice.text : `${trimmed} ${notice.text}`
}

/** The notice of a fact the guard refused: health and body data always, the rest only against a false claim. */
export const getRejectedFactNotice = (
	issue: FactTextIssue | 'EMPTY' | 'TOO_LONG',
): MemoryNotice => {
	if (issue === 'HEALTH_DATA') return { text: FACT_HEALTH_REPLY, isQuietUnlessClaimed: false }
	if (issue === 'BODY_DATA') return { text: FACT_BODY_REPLY, isQuietUnlessClaimed: false }
	if (issue === 'TOO_LONG') return { text: FACT_TOO_LONG_REPLY, isQuietUnlessClaimed: true }
	return { text: FACT_NOT_SAVED_REPLY, isQuietUnlessClaimed: true }
}
