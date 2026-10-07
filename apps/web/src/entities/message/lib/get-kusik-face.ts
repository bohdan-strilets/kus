import type { HamsterHeadMood } from '@/shared/ui'

/** What Kusik's reply is about — the context the avatar face follows. */
export type KusikReplyKind =
	| 'reply'
	| 'mealLogged'
	| 'clarify'
	| 'photoEstimate'
	| 'typing'
	| 'suggestion'
	| 'error'
	| 'newDay'
	| 'weeklySummary'
	| 'newRecipe'
	| 'weight'

/**
 * Face per reply, taken from the avatars in design/mockups/chat*.html (and docs/components.md):
 * chat / chat-clarify (meal card) → smile, chat-photo and chat-typing → think, chat «що на вечерю»
 * → happy, chat-error → oops, chat-new-day and chat-weekly-summary → smileOpen, chat-new-recipe →
 * content, chat-weight → proud. hungry is used outside chat bubbles (the dinner tip on «Сьогодні»).
 */
const FACE_BY_REPLY: Record<KusikReplyKind, HamsterHeadMood> = {
	reply: 'smile',
	mealLogged: 'smile',
	clarify: 'smile',
	photoEstimate: 'think',
	typing: 'think',
	suggestion: 'happy',
	error: 'oops',
	newDay: 'smileOpen',
	weeklySummary: 'smileOpen',
	newRecipe: 'content',
	weight: 'proud',
}

export const getKusikFace = (kind: KusikReplyKind): HamsterHeadMood => FACE_BY_REPLY[kind]
