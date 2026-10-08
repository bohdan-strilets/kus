import { describe, expect, it } from 'vitest'

import { envSchema } from './env.schema'

const baseEnv = {
	DATABASE_URL: 'postgresql://kus:kus@localhost:5434/kus',
	CORS_ORIGIN: 'http://localhost:5173',
	OPENROUTER_API_KEY: 'key',
	AI_MODEL: 'provider/model',
	JWT_ACCESS_SECRET: 'a'.repeat(32),
}

describe('envSchema CORS_ORIGIN', () => {
	it('normalizes a comma-separated list to bare origins', () => {
		const env = envSchema.parse({
			...baseEnv,
			CORS_ORIGIN: 'https://kus.vercel.app/ , http://localhost:5173/some/path',
		})

		expect(env.CORS_ORIGIN).toEqual(['https://kus.vercel.app', 'http://localhost:5173'])
	})

	it('rejects a wildcard origin', () => {
		expect(envSchema.safeParse({ ...baseEnv, CORS_ORIGIN: '*' }).success).toBe(false)
	})

	it('rejects non-http protocols', () => {
		expect(envSchema.safeParse({ ...baseEnv, CORS_ORIGIN: 'ftp://kus.app' }).success).toBe(false)
	})
})

describe('envSchema auth', () => {
	it('rejects a JWT secret shorter than 32 characters', () => {
		expect(envSchema.safeParse({ ...baseEnv, JWT_ACCESS_SECRET: 'a'.repeat(31) }).success).toBe(
			false,
		)
	})

	it('keeps registration closed unless explicitly enabled', () => {
		expect(envSchema.parse(baseEnv).ALLOW_REGISTRATION).toBe(false)
		expect(envSchema.parse({ ...baseEnv, ALLOW_REGISTRATION: 'true' }).ALLOW_REGISTRATION).toBe(
			true,
		)
		expect(envSchema.parse({ ...baseEnv, ALLOW_REGISTRATION: 'false' }).ALLOW_REGISTRATION).toBe(
			false,
		)
	})

	it('rejects an ambiguous ALLOW_REGISTRATION value', () => {
		expect(envSchema.safeParse({ ...baseEnv, ALLOW_REGISTRATION: 'maybe' }).success).toBe(false)
	})
})

describe('envSchema API_PROXY_SECRET', () => {
	it('is required in production, so the API never runs open behind Railway', () => {
		expect(envSchema.safeParse({ ...baseEnv, NODE_ENV: 'production' }).success).toBe(false)
		expect(
			envSchema.safeParse({ ...baseEnv, NODE_ENV: 'production', API_PROXY_SECRET: 'p'.repeat(32) })
				.success,
		).toBe(true)
	})

	it('stays optional outside production and rejects a short secret', () => {
		expect(envSchema.parse(baseEnv).API_PROXY_SECRET).toBeUndefined()
		expect(envSchema.safeParse({ ...baseEnv, API_PROXY_SECRET: 'p'.repeat(31) }).success).toBe(
			false,
		)
	})
})

describe('envSchema AI', () => {
	it('falls back to AI_MODEL for empty or unset purpose models', () => {
		const env = envSchema.parse({ ...baseEnv, AI_MODEL_VISION: '  ' })
		expect(env.AI_MODEL_VISION).toBe('provider/model')
		expect(env.AI_MODEL_CHAT).toBe('provider/model')
	})

	it('keeps an explicit purpose model', () => {
		const env = envSchema.parse({ ...baseEnv, AI_MODEL_VISION: 'provider/vision' })
		expect(env.AI_MODEL_VISION).toBe('provider/vision')
	})

	it('defaults the timeout and the daily limit, and rejects a zero limit', () => {
		const env = envSchema.parse(baseEnv)
		expect(env.AI_TIMEOUT_MS).toBe(60_000)
		expect(env.AI_DAILY_MESSAGE_LIMIT).toBe(100)
		expect(envSchema.safeParse({ ...baseEnv, AI_DAILY_MESSAGE_LIMIT: '0' }).success).toBe(false)
	})
})
