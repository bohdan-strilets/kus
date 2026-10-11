// Builds the model input: static prompt (cacheable) + day/memory context + recent turns + the message.
import type { FoodCategory, MealType } from '../schemas/enums.js'
import {
	type DeletedEntryContext,
	formatEditContext,
	type OpenClarificationContext,
	type TodayEntryContext,
} from './edit-context.js'
import { SYSTEM_PROMPT } from './prompt.js'

/** Rough size estimate; good enough to cap history without shipping a tokenizer. */
const CHARS_PER_TOKEN = 4
export const HISTORY_MAX_TOKENS = 1500
export const HISTORY_MAX_MESSAGES = 6
export const HISTORY_MESSAGE_MAX_CHARS = 500
export const MEMORY_MAX_FOODS = 10

export interface MacroTotals {
	kcal: number
	protein: number
	fat: number
	carbs: number
}

export interface DayMealContext {
	type: MealType
	kcal: number
}

export interface GoalContext {
	dailyKcal: number
	protein: number
	fat: number
	carbs: number
	/** Computed by the backend: dailyKcal − eaten; negative when over. */
	remainingKcal: number
}

export interface MemoryFoodContext {
	/** `m1`… — the model never sees database ids. */
	ref: string
	name: string
	aliases: string[]
	per100g: MacroTotals
	pieceGrams: number | null
	defaultGrams: number | null
	category: FoodCategory
}

export interface HistoryTurn {
	role: 'user' | 'assistant'
	content: string
	/** The user turn carried a photo; the model sees a marker, never the image again. */
	hasPhoto?: boolean
}

/** In the user's language, like the chat itself: the model answers in it anyway. */
export const PHOTO_HISTORY_MARKER = '[фото]'

const toHistoryText = ({ content, hasPhoto = false }: HistoryTurn): string => {
	if (!hasPhoto) return content
	return content.length > 0 ? `${PHOTO_HISTORY_MARKER} ${content}` : PHOTO_HISTORY_MARKER
}

export interface FoodParseContext {
	/** Local wall-clock time of the user, `YYYY-MM-DD HH:mm, Weekday`. */
	localTime: string
	dayTotals: MacroTotals
	meals: DayMealContext[]
	/** Today's active entries, oldest first: the newest MAX_CONTEXT_ENTRIES. */
	entries: TodayEntryContext[]
	deletedEntries: DeletedEntryContext[]
	openClarifications: OpenClarificationContext[]
	goal: GoalContext | null
	memory: MemoryFoodContext[]
	/** Oldest first. */
	history: HistoryTurn[]
}

export interface AiTextPart {
	type: 'text'
	text: string
	/** Anthropic-style prompt cache breakpoint; OpenRouter translates it for other providers. */
	cache_control?: { type: 'ephemeral' }
}

/** OpenAI-compatible image part; OpenRouter passes a data URL to the provider as the image itself. */
export interface AiImagePart {
	type: 'image_url'
	image_url: { url: string }
}

export type AiUserPart = AiTextPart | AiImagePart

export type AiChatMessage =
	| { role: 'system'; content: AiTextPart[] }
	| { role: 'user'; content: string | AiUserPart[] }
	| { role: 'assistant'; content: string }

export const AI_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AiImageMimeType = (typeof AI_IMAGE_MIME_TYPES)[number]

/** One photo of the message, already resized by the client; the bytes live only in this request. */
export interface AiImageInput {
	mimeType: AiImageMimeType
	base64: string
}

const toImagePart = ({ mimeType, base64 }: AiImageInput): AiImagePart => ({
	type: 'image_url',
	image_url: { url: `data:${mimeType};base64,${base64}` },
})

/** Image first, then the words: the order the vision docs recommend. */
const toUserContent = (text: string, image: AiImageInput | undefined): string | AiUserPart[] => {
	if (!image) return text
	const parts: AiUserPart[] = [toImagePart(image)]
	if (text.length > 0) parts.push({ type: 'text', text })
	return parts
}

const round = (value: number): number => Math.round(value)

const formatMacros = ({ kcal, protein, fat, carbs }: MacroTotals): string =>
	`${round(kcal)} kcal, P ${round(protein)} g, F ${round(fat)} g, C ${round(carbs)} g`

const formatGoal = (goal: GoalContext | null): string => {
	if (!goal) return 'Goal: not set.'
	const remaining =
		goal.remainingKcal >= 0
			? `Remaining today: ${round(goal.remainingKcal)} kcal.`
			: `Over the goal by ${round(-goal.remainingKcal)} kcal.`
	return `Goal: ${formatMacros({ kcal: goal.dailyKcal, protein: goal.protein, fat: goal.fat, carbs: goal.carbs })} per day. ${remaining}`
}

const formatMemoryFood = (food: MemoryFoodContext): string => {
	const aliases = food.aliases.length > 0 ? ` (also: ${food.aliases.join(', ')})` : ''
	const piece = food.pieceGrams === null ? '' : `; 1 piece = ${food.pieceGrams} g`
	const usual = food.defaultGrams === null ? '' : `; usual portion ${food.defaultGrams} g`
	return `${food.ref}: "${food.name}"${aliases} — per 100 g: ${formatMacros(food.per100g)}${piece}${usual}; category ${food.category}`
}

export const formatContext = (context: FoodParseContext): string => {
	const meals =
		context.meals.length === 0
			? []
			: [
					`Meals: ${context.meals.map((meal) => `${meal.type} ${round(meal.kcal)} kcal`).join(', ')}.`,
				]
	const memory =
		context.memory.length === 0
			? 'Saved foods: none match this message.'
			: `Saved foods (use memoryRef when the user means one of these):\n${context.memory.map(formatMemoryFood).join('\n')}`

	return [
		`Local time: ${context.localTime}.`,
		`Eaten today: ${formatMacros(context.dayTotals)}.`,
		...meals,
		...formatEditContext(context),
		formatGoal(context.goal),
		memory,
	].join('\n')
}

const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN)

/** Most recent turns that fit the budget, oldest first; long messages are cut. */
export const selectHistory = (turns: HistoryTurn[]): HistoryTurn[] => {
	const selected: HistoryTurn[] = []
	let budget = HISTORY_MAX_TOKENS
	for (const turn of turns.slice(-HISTORY_MAX_MESSAGES).reverse()) {
		const content = toHistoryText(turn).slice(0, HISTORY_MESSAGE_MAX_CHARS)
		budget -= estimateTokens(content)
		if (budget < 0) break
		selected.unshift({ role: turn.role, content })
	}
	return selected
}

export const buildFoodParseMessages = (
	context: FoodParseContext,
	text: string,
	image?: AiImageInput,
): AiChatMessage[] => [
	{
		role: 'system',
		content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
	},
	{ role: 'system', content: [{ type: 'text', text: formatContext(context) }] },
	...selectHistory(context.history),
	{ role: 'user', content: toUserContent(text, image) },
]
