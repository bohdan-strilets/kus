// What the model remembers of the chat: the whole local day in full, and a short tail of the day
// before. Shared, so the backend and the eval pick the same messages.
import {
	formatHistoryMarkers,
	formatKusikMarkers,
	type HistoryMarkerFields,
} from './history-markers.js'

/** The day starts this many hours before local midnight: the evening talk is still part of it. */
export const DAY_HISTORY_LOOKBACK_HOURS = 4
/** The valve: a day above this many tokens loses its oldest messages. */
export const DAY_HISTORY_MAX_TOKENS = 20_000
/**
 * The valve cuts in blocks of this size, so the cut point stays where it is while the day grows and
 * the prompt cache of the history survives the turns between two cuts.
 */
export const DAY_HISTORY_TRIM_STEP_TOKENS = 5_000
export const PREVIOUS_DAY_TAIL_MAX_MESSAGES = 6
export const PREVIOUS_DAY_TAIL_MAX_TOKENS = 1_500
/** Calibrated on Claude Sonnet 5.5 with Ukrainian text: about 2.5 characters per token. */
export const HISTORY_CHARS_PER_TOKEN = 2.5

/** In the user's language, like the chat itself: the model answers in it anyway. */
export const PHOTO_HISTORY_MARKER = '[фото]'

export interface HistoryTurn extends HistoryMarkerFields {
	role: 'user' | 'assistant'
	content: string
	/** The user turn carried a photo; the model sees a marker, never the image again. */
	hasPhoto?: boolean
}

/** A history message as the model reads it: the words with the markers in front. */
export interface HistoryMessage {
	role: 'user' | 'assistant'
	content: string
}

export const toHistoryText = (turn: HistoryTurn): string => {
	const { role, content, hasPhoto = false } = turn
	const markers = role === 'user' ? formatHistoryMarkers(turn) : formatKusikMarkers(turn)
	const prefix = markers.length > 0 ? `${markers.join(' ')} ` : ''
	if (!hasPhoto) return `${prefix}${content}`
	const withPhoto = content.length > 0 ? `${PHOTO_HISTORY_MARKER} ${content}` : PHOTO_HISTORY_MARKER
	return `${prefix}${withPhoto}`
}

export const estimateHistoryTokens = (text: string): number =>
	Math.ceil(text.length / HISTORY_CHARS_PER_TOKEN)

const toHistoryMessage = (turn: HistoryTurn): HistoryMessage => ({
	role: turn.role,
	content: toHistoryText(turn),
})

/** The history starts with the user's message; without one there is nothing to keep. */
const getFirstUserIndex = (messages: HistoryMessage[], from: number): number => {
	let index = from
	while (index < messages.length && messages[index]?.role !== 'user') index += 1
	return index
}

export interface DayHistorySelection {
	messages: HistoryMessage[]
	/** Messages left out: the valve's cut and an answer without its question. */
	droppedCount: number
	/** The valve cut the day: there is no room for the day before. */
	isTrimmed: boolean
	/** Estimated tokens of the kept messages. */
	tokens: number
}

/**
 * The day, oldest first. Above DAY_HISTORY_MAX_TOKENS the oldest messages go, whole, in blocks of
 * DAY_HISTORY_TRIM_STEP_TOKENS: the cut moves only when the day outgrows the next block.
 */
export const selectDayHistory = (turns: HistoryTurn[]): DayHistorySelection => {
	const messages = turns.map(toHistoryMessage)
	const sizes = messages.map(({ content }) => estimateHistoryTokens(content))
	const total = sizes.reduce((sum, size) => sum + size, 0)
	let start = 0
	if (total > DAY_HISTORY_MAX_TOKENS) {
		const blocks = Math.ceil((total - DAY_HISTORY_MAX_TOKENS) / DAY_HISTORY_TRIM_STEP_TOKENS)
		const toDrop = blocks * DAY_HISTORY_TRIM_STEP_TOKENS
		let dropped = 0
		while (start < messages.length - 1 && dropped < toDrop) {
			dropped += sizes[start] ?? 0
			start += 1
		}
	}
	const isTrimmed = start > 0
	start = getFirstUserIndex(messages, start)
	return {
		messages: messages.slice(start),
		droppedCount: start,
		isTrimmed,
		tokens: sizes.slice(start).reduce((sum, size) => sum + size, 0),
	}
}

/**
 * The end of the day before, oldest first: whole messages from the end, the first one that does not
 * fit stops the pick. Nothing when the valve already cut today.
 */
export const selectPreviousDayTail = (
	turns: HistoryTurn[],
	{ isDayTrimmed }: { isDayTrimmed: boolean },
): HistoryMessage[] => {
	if (isDayTrimmed) return []
	const selected: HistoryMessage[] = []
	let budget = PREVIOUS_DAY_TAIL_MAX_TOKENS
	for (const turn of turns.slice(-PREVIOUS_DAY_TAIL_MAX_MESSAGES).reverse()) {
		const message = toHistoryMessage(turn)
		budget -= estimateHistoryTokens(message.content)
		if (budget < 0) break
		selected.unshift(message)
	}
	return selected.slice(getFirstUserIndex(selected, 0))
}
