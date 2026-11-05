import { describe, expect, it } from 'vitest'

import {
	AI_STATS_ADVICE_DEADLINE_MS,
	AI_STATS_ADVICE_MIN_MS,
	CHAT_TURN_DB_BUDGET_MS,
	VERCEL_PROXY_TIMEOUT_MS,
} from './ai.constants'
import { getStatsAdviceDeadlineMs } from './stats-advice-budget'

const LIMIT_MS = VERCEL_PROXY_TIMEOUT_MS - CHAT_TURN_DB_BUDGET_MS

describe('getStatsAdviceDeadlineMs', () => {
	it('keeps the call deadline when a lot of time is left', () => {
		expect(getStatsAdviceDeadlineMs(0)).toBe(AI_STATS_ADVICE_DEADLINE_MS)
		expect(getStatsAdviceDeadlineMs(LIMIT_MS - AI_STATS_ADVICE_DEADLINE_MS)).toBe(
			AI_STATS_ADVICE_DEADLINE_MS,
		)
	})

	it('gives what is left of the proxy time when it is less than the call deadline', () => {
		expect(getStatsAdviceDeadlineMs(LIMIT_MS - 10_000)).toBe(10_000)
		expect(getStatsAdviceDeadlineMs(LIMIT_MS - AI_STATS_ADVICE_MIN_MS)).toBe(AI_STATS_ADVICE_MIN_MS)
	})

	it('gives null when less than the minimum is left', () => {
		expect(getStatsAdviceDeadlineMs(LIMIT_MS - AI_STATS_ADVICE_MIN_MS + 1)).toBeNull()
		expect(getStatsAdviceDeadlineMs(LIMIT_MS + 10_000)).toBeNull()
	})
})
