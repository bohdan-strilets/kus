import type { ClarifyKind } from '@kus/shared'

export type ActualDecision = 'log' | 'clarify' | 'edit' | 'not_food' | 'reply' | 'error'

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
	decisions: RateStats & { byExpected: Record<string, RateStats> }
	costUsd: { total: number; perCase: number }
	latencyMs: { p50: number; p95: number }
	tokens: { inputPerCase: number; outputPerCase: number; cachedPerCase: number }
	/** Model calls (first tries + retries) and how many of them came back without a tool call. */
	modelCalls: { total: number; textOnly: number }
}
