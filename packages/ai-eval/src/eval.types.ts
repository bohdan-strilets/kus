export type ActualDecision = 'log' | 'clarify' | 'not_food' | 'reply' | 'error'

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
	replyText: string | null
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
	options: { label: string; kcal: number }[]
	impactKcal: number
	/** Passed the thresholds (≥ 80 kcal and ≥ 15 %, max 2) and would reach the user. */
	isKept: boolean
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
	decisions: RateStats & { byExpected: Record<string, RateStats> }
	costUsd: { total: number; perCase: number }
	latencyMs: { p50: number; p95: number }
	tokens: { inputPerCase: number; outputPerCase: number; cachedPerCase: number }
	/** Model calls (first tries + retries) and how many of them came back without a tool call. */
	modelCalls: { total: number; textOnly: number }
}
