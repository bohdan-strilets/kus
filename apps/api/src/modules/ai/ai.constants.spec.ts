import { AI_VALIDATION_RETRY_COUNT, MAX_READ_STEPS } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { envSchema } from '../../config/env.schema'
import {
	AI_NETWORK_RETRIES,
	AI_PARSE_DEADLINE_MS,
	AI_READ_MIN_REMAINING_MS,
	CHAT_TURN_DB_BUDGET_MS,
	VERCEL_PROXY_TIMEOUT_MS,
} from './ai.constants'

const env = {
	DATABASE_URL: 'postgresql://kus:kus@localhost:5434/kus',
	CORS_ORIGIN: 'http://localhost:5173',
	OPENROUTER_API_KEY: 'key',
	AI_MODEL: 'provider/model',
	JWT_ACCESS_SECRET: 'a'.repeat(32),
}

describe('AI time limits behind the Vercel proxy', () => {
	it('ends a whole chat turn before Vercel cuts the proxied request', () => {
		expect(AI_PARSE_DEADLINE_MS + CHAT_TURN_DB_BUDGET_MS).toBeLessThanOrEqual(
			VERCEL_PROXY_TIMEOUT_MS,
		)
	})

	it('lets an attempt and its network retry run in full inside the deadline by default', () => {
		const { AI_TIMEOUT_MS } = envSchema.parse(env)
		expect(AI_TIMEOUT_MS * (AI_NETWORK_RETRIES + 1)).toBeLessThanOrEqual(AI_PARSE_DEADLINE_MS)
	})

	it('shares one deadline between the worst case of 1 + reads + retry calls', () => {
		const { AI_TIMEOUT_MS } = envSchema.parse(env)
		const worstCaseCalls = 1 + MAX_READ_STEPS + AI_VALIDATION_RETRY_COUNT
		expect(worstCaseCalls).toBe(4)
		// the deadline is not worstCaseCalls × a call's timeout: a turn that slow is cut by the shared signal
		expect(AI_PARSE_DEADLINE_MS).toBeLessThan(worstCaseCalls * AI_TIMEOUT_MS)
		expect(AI_PARSE_DEADLINE_MS + CHAT_TURN_DB_BUDGET_MS).toBeLessThanOrEqual(
			VERCEL_PROXY_TIMEOUT_MS,
		)
	})

	it('closes reading while a full final answer still fits in what is left', () => {
		const { AI_TIMEOUT_MS } = envSchema.parse(env)
		expect(AI_READ_MIN_REMAINING_MS).toBeGreaterThan(0)
		expect(AI_READ_MIN_REMAINING_MS).toBeLessThan(AI_PARSE_DEADLINE_MS - AI_TIMEOUT_MS)
	})

	it('accepts no per-attempt timeout longer than the whole deadline', () => {
		const at = (ms: number) => envSchema.safeParse({ ...env, AI_TIMEOUT_MS: String(ms) }).success
		expect(at(AI_PARSE_DEADLINE_MS)).toBe(true)
		expect(at(AI_PARSE_DEADLINE_MS + 1)).toBe(false)
	})
})
