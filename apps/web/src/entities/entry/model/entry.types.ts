import type { FoodCategory } from '@/shared/ui'

/** Grams of protein / carbs / fat — always shown in this order (Б → В → Ж). */
export interface MacroAmounts {
	protein: number
	carbs: number
	fat: number
}

/**
 * How the caption under a food line reads (mockups/chat.html, chat-clarify.html):
 * plain — «3 шт · 150 г»; hint — «100 г · суха?» with a tappable question;
 * usual — «250 мл · як завжди» (from memory); copied — «250 г · як учора» (taken over from an
 * earlier day, mockups/chat-as-yesterday.html); estimate — «оцінка» under the «Без деталей» line
 * of a closed day (mockups/chat-day-closed.html); clarifying — «100 г · уточнюємо» while a
 * question is open.
 */
export type EntryCaptionState = 'plain' | 'hint' | 'usual' | 'copied' | 'estimate' | 'clarifying'

export interface FoodEntryView {
	id: string
	name: string
	/** Amount as the AI wrote it, e.g. «3 шт · 150 г». */
	amount: string
	kcal: number
	/** Picks the icon; null until the AI sets one (shown as the plate). */
	category: FoodCategory | null
	captionState?: EntryCaptionState
	/** The question for the `hint` state, e.g. «суха?». */
	hint?: string
	/** The mark for the `copied` state: «як учора», «як у п'ятницю», «як 16.10». */
	copiedLabel?: string
	/** The «Без деталей» estimate of a closed day: the `more` tile, «оцінка» and «≈ 300». */
	isEstimate?: boolean
}
