// Builds the model input: static prompt (cacheable) + day/memory context + recent turns + the message.
import type { AddressForm, FoodCategory, MealType, MeasurementKind } from '../schemas/enums.js'
import { getWeekday, type LoggableDayLabel } from './dates.js'
import {
	type DeletedEntryContext,
	formatEditContext,
	type OpenClarificationContext,
	type TodayEntryContext,
} from './edit-context.js'
import { type EarlierEntryContext, formatEarlierEntries } from './history-context.js'
import type { MeasurementPoint } from './measurements.js'
import { SYSTEM_PROMPT } from './prompt.js'
import type { ExerciseContext, TodayWorkoutContext } from './workout-context.js'

/** Rough size estimate; good enough to cap history without shipping a tokenizer. */
const CHARS_PER_TOKEN = 4
export const HISTORY_MAX_TOKENS = 1500
export const HISTORY_MAX_MESSAGES = 6
/** Kusik's replies may be up to REPLY_MAX_LENGTH (1000), so history keeps them whole. */
export const HISTORY_MESSAGE_MAX_CHARS = 1000
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
	/** Refs of today's entries this user turn logged; the model must not log them again. */
	loggedRefs?: string[]
	/** The user turn logged entries, but none of them is in today's context window: no ref to show. */
	hasLoggedEntries?: boolean
}

/** In the user's language, like the chat itself: the model answers in it anyway. */
export const PHOTO_HISTORY_MARKER = '[фото]'

// first, so that cutting a long message never drops it
const formatLoggedMarker = ({
	role,
	loggedRefs = [],
	hasLoggedEntries = false,
}: HistoryTurn): string => {
	if (role !== 'user') return ''
	if (loggedRefs.length > 0) return `[logged: ${loggedRefs.join(', ')}] `
	return hasLoggedEntries ? '[logged] ' : ''
}

const toHistoryText = (turn: HistoryTurn): string => {
	const { content, hasPhoto = false } = turn
	const marker = formatLoggedMarker(turn)
	if (!hasPhoto) return `${marker}${content}`
	const withPhoto = content.length > 0 ? `${PHOTO_HISTORY_MARKER} ${content}` : PHOTO_HISTORY_MARKER
	return `${marker}${withPhoto}`
}

/** A stored value of the last days, listed so the model can fix or delete it. */
export interface RecentMeasurementContext {
	kind: MeasurementKind
	/** `YYYY-MM-DD` */
	localDate: string
	value: number
}

/** A day the user can log to, with what the backend counted for it. */
export interface DayContext {
	/** `YYYY-MM-DD` */
	localDate: string
	label: LoggableDayLabel | null
	kcal: number
	/** Past days only: kcal over the goal, null when within it or without a goal. */
	overKcal: number | null
	entryCount: number
}

/** The latest body measurements; the model compares them with a new one and never calculates. */
export interface MeasurementsContext {
	/** The user's local day, `YYYY-MM-DD`. */
	today: string
	/** The two latest weights, newest first. */
	weights: MeasurementPoint[]
	waist: MeasurementPoint | null
	targetWeightKg: number | null
	/** Values of the last 7 days, both kinds; none when omitted. */
	recent?: RecentMeasurementContext[]
}

export interface FoodParseContext {
	/** Local wall-clock time of the user, `YYYY-MM-DD HH:mm, Weekday`. */
	localTime: string
	/** The gender forms the user chose; the line is always there when it is set. */
	addressForm?: AddressForm
	dayTotals: MacroTotals
	meals: DayMealContext[]
	/** Today's active entries, oldest first: the newest MAX_CONTEXT_ENTRIES. */
	entries: TodayEntryContext[]
	deletedEntries: DeletedEntryContext[]
	openClarifications: OpenClarificationContext[]
	/** Today's workouts, oldest first; no section when omitted or empty. */
	workouts?: TodayWorkoutContext[]
	/** Workouts deleted today (refs for restore_entry). */
	deletedWorkouts?: TodayWorkoutContext[]
	/** The exercises of the dictionary the message names; no section when omitted or empty. */
	exercises?: ExerciseContext[]
	goal: GoalContext | null
	/** Today − 3 … today + 1; no line in the context when omitted or empty. */
	days?: DayContext[]
	measurements: MeasurementsContext
	memory: MemoryFoodContext[]
	/** Only for a message that points back («як вчора»); no section when omitted or empty. */
	earlier?: EarlierEntryContext[]
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

const formatPoint = ({ value, localDate }: MeasurementPoint, unit: string): string =>
	`${value} ${unit} on ${localDate}`

export const formatMeasurements = ({
	weights,
	waist,
	targetWeightKg,
}: MeasurementsContext): string => {
	const weight =
		weights.length === 0
			? 'Weight: none logged.'
			: `Weight: ${weights.map((point) => formatPoint(point, 'kg')).join('; ')}.`
	const waistLine = waist ? ` Waist: ${formatPoint(waist, 'cm')}.` : ''
	const target = targetWeightKg === null ? '' : ` Target weight: ${targetWeightKg} kg.`
	return `${weight}${waistLine}${target}`
}

const formatDay = ({ localDate, label, kcal, overKcal, entryCount }: DayContext): string => {
	const head = `${localDate} ${getWeekday(localDate)}${label ? ` (${label})` : ''}`
	// today's total is already in "Eaten today"
	if (label === 'today') return head
	if (entryCount === 0) return `${head}: nothing logged`
	if (label === 'tomorrow') return `${head}: ${round(kcal)} kcal planned`
	const over = overKcal === null ? '' : `, over the goal by ${round(overKcal)}`
	return `${head}: ${round(kcal)} kcal${over}`
}

export const formatDays = (days: readonly DayContext[]): string[] =>
	days.length === 0 ? [] : [`Days: ${days.map(formatDay).join('; ')}.`]

export const formatRecentMeasurements = (recent: readonly RecentMeasurementContext[]): string[] =>
	recent.length === 0
		? []
		: [
				`Recent measurements: ${recent.map(({ kind, localDate, value }) => `${kind} ${localDate} ${value}`).join('; ')}.`,
			]

const formatMemoryFood = (food: MemoryFoodContext): string => {
	const aliases = food.aliases.length > 0 ? ` (also: ${food.aliases.join(', ')})` : ''
	const piece = food.pieceGrams === null ? '' : `; 1 piece = ${food.pieceGrams} g`
	const usual = food.defaultGrams === null ? '' : `; usual portion ${food.defaultGrams} g`
	return `${food.ref}: "${food.name}"${aliases} — per 100 g: ${formatMacros(food.per100g)}${piece}${usual}; category ${food.category}`
}

const ADDRESS_FORM_LABELS: Readonly<Record<AddressForm, string>> = {
	MASCULINE: 'masculine',
	FEMININE: 'feminine',
	NEUTRAL: 'neutral',
}

const formatAddressForm = (form: AddressForm | undefined): string[] =>
	form === undefined ? [] : [`Address form: ${ADDRESS_FORM_LABELS[form]}.`]

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
		...formatAddressForm(context.addressForm),
		`Eaten today: ${formatMacros(context.dayTotals)}.`,
		...meals,
		...formatEditContext(context),
		formatGoal(context.goal),
		...formatDays(context.days ?? []),
		formatMeasurements(context.measurements),
		...formatRecentMeasurements(context.measurements.recent ?? []),
		memory,
		...formatEarlierEntries(context.earlier ?? []),
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
