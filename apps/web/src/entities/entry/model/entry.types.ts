import type { FoodIconKind } from '@/shared/ui'

/** Grams of protein / carbs / fat — always shown in this order (Б → В → Ж). */
export interface MacroAmounts {
	protein: number
	carbs: number
	fat: number
}

/**
 * How the caption under a food line reads (mockups/chat.html, chat-clarify.html):
 * plain — «3 шт · 150 г»; hint — «100 г · суха?» with a tappable question;
 * usual — «як завжди» (from memory); clarifying — «100 г · уточнюємо» while a question is open.
 */
export type EntryCaptionState = 'plain' | 'hint' | 'usual' | 'clarifying'

export interface FoodEntryView {
	id: string
	name: string
	/** Amount as the AI wrote it, e.g. «3 шт · 150 г». */
	amount: string
	kcal: number
	icon?: FoodIconKind
	captionState?: EntryCaptionState
	/** The question for the `hint` state, e.g. «суха?». */
	hint?: string
}
