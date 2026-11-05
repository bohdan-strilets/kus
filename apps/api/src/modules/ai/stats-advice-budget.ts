import {
	AI_STATS_ADVICE_DEADLINE_MS,
	AI_STATS_ADVICE_MIN_MS,
	CHAT_TURN_DB_BUDGET_MS,
	VERCEL_PROXY_TIMEOUT_MS,
} from './ai.constants'

/**
 * The time the advice call may take: what is left of Vercel's proxy limit after the DB work and the
 * time the turn has already spent, capped by the call's own deadline. Null when too little is left
 * to be worth a second call — the turn then answers with the card and a sentence of its own.
 */
export const getStatsAdviceDeadlineMs = (elapsedMs: number): number | null => {
	const left = VERCEL_PROXY_TIMEOUT_MS - CHAT_TURN_DB_BUDGET_MS - elapsedMs
	const deadlineMs = Math.min(AI_STATS_ADVICE_DEADLINE_MS, left)
	return deadlineMs < AI_STATS_ADVICE_MIN_MS ? null : deadlineMs
}
