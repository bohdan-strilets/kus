import type { ClarifyKind, MeasurementKind, StatsPeriod } from '@kus/shared'

export type ActualDecision =
	| 'log'
	| 'clarify'
	| 'edit'
	| 'not_food'
	| 'photo_unusable'
	| 'reply'
	| 'day_card'
	| 'close_day'
	| 'stats'
	| 'error'

export interface ValidationAttempt {
	attempt: number
	/** Tools the model called in this attempt (empty = a text-only answer). */
	callNames: string[]
	/** parseToolCalls error texts (code-generated, cut to 200 chars; no user message content). */
	errors: string[]
}

/** What the raw tool calls say about days; the newer tools are matched by name, not by shared types. */
export interface CallFacts {
	/** The day of the first log_food (null date = today); null when nothing was logged. */
	logDate: string | null
	/** Per logged item: its own day, else the call's, else today. */
	itemDates: { name: string; date: string }[]
	/** Every show_day call, its day resolved. */
	dayCards: { date: string }[]
	/** Every delete_measurement call, its day resolved. */
	deletedMeasurements: { kind: MeasurementKind; date: string }[]
	/** Every close_day call, its day resolved; null total = the user named none. */
	closeDays: { date: string; estimatedTotalKcal: number | null }[]
	/** Every show_stats call; null end = today. */
	statsCards: { period: StatsPeriod; endDate: string | null }[]
}

export interface CaseResult {
	caseId: string
	model: string
	decision: ActualDecision
	/** Needed the validation retry (or failed). */
	wasRetried: boolean
	attempts: number
	error: string | null
	/** Sum over logged items; null when nothing was logged. */
	kcal: number | null
	protein: number | null
	categories: string[]
	/** The chat answer: reply text, log_food's reply or the edit turn's reply. */
	replyText: string | null
	/** What the edit tools changed (refs of the case context); null when the answer changed nothing. */
	edits: EditResult | null
	/** What log_measurement recorded (the day resolved); empty when nothing was. */
	measurements: MeasuredItem[]
	/** Days named by log_food, show_day and delete_measurement. */
	calls: CallFacts
	costUsd: number
	latencyMs: number
	inputTokens: number
	outputTokens: number
	cachedTokens: number
	/** Logged items, kept in results/ (gitignored) for per-item analysis; never printed. */
	items: LoggedItem[]
	/** Every valid clarify call of the final answer, including the ones below the backend threshold. */
	clarifyCalls: ClarifyCall[]
	/** The answer hit max_tokens (OUTPUT_TRUNCATED). */
	truncated: boolean
	/** Model calls answered with text instead of a tool call (possible with tool_choice "auto"). */
	textOnlyAnswers: number
	/** Every failed validation attempt, also when a retry then succeeded; empty when the first try passed. */
	validationErrors: ValidationAttempt[]
	/** Words in the reply that mix Cyrillic and Latin letters. */
	mixedScriptWords: string[]
}

export interface ClarifyCall {
	question: string
	options: { label: string; kcal: number; name: string | null }[]
	impactKcal: number
	/** rename — which food it was: kept without the kcal thresholds when its shape fits. */
	kind: ClarifyKind
	/** Passed the thresholds (≥ 80 kcal and ≥ 15 %, or a rename; max 2) and would reach the user. */
	isKept: boolean
}

export interface MeasuredItem {
	kind: MeasurementKind
	value: number
	/** `YYYY-MM-DD` */
	date: string
	confirmedJump: boolean
}

export interface EditResult {
	/** Values as the backend would store them (a new weight alone rescales the entry). */
	corrections: { ref: string; name: string; grams: number; kcal: number }[]
	deletions: string[]
	restorations: string[]
	resolutions: {
		ref: string
		kind: 'option' | 'values' | 'close'
		optionIndex: number | null
		/** Option or given kcal; null when closed without values. */
		kcal: number | null
	}[]
}

export interface LoggedItem {
	name: string
	/** The item's own meal, else the message's; null = the backend would use the clock. */
	mealType: string | null
	grams: number
	quantity: number | null
	kcal: number
	protein: number
	source: string
	memoryRef: string | null
	/** Ref of the earlier entry the item copies (y1, h1); null = not a copy. */
	copyRef: string | null
	assumption: string | null
}

export interface ErrorStats {
	/** Cases with a reference and a logged answer. */
	count: number
	meanPct: number | null
	medianPct: number | null
}

export interface RateStats {
	correct: number
	total: number
}

export interface ModelSummary {
	model: string
	cases: number
	failed: number
	retried: number
	truncated: number
	kcal: { exact: ErrorStats; range: ErrorStats }
	protein: { exact: ErrorStats; range: ErrorStats }
	categories: RateStats
	/** Items of whole-day cases placed in the expected meal. */
	meals: RateStats
	/** Cases with expected edits whose edits all matched. */
	edits: RateStats
	/** Cases with expected measurements whose recorded set matched exactly (none expected = none recorded). */
	measurements: RateStats
	/** Cases with expected log/item/card/deleted days or item count whose calls all matched. */
	details: RateStats
	/** Cases with expected sources whose every logged item carries one of them (labels → LABEL). */
	sources: RateStats
	decisions: RateStats & { byExpected: Record<string, RateStats> }
	costUsd: { total: number; perCase: number }
	latencyMs: { p50: number; p95: number }
	tokens: { inputPerCase: number; outputPerCase: number; cachedPerCase: number }
	/** Model calls (first tries + retries) and how many of them came back without a tool call. */
	modelCalls: { total: number; textOnly: number }
}
