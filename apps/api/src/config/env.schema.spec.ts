import { describe, expect, it } from 'vitest'

import { envSchema } from './env.schema'

const s3Env = {
	STORAGE_PROVIDER: 's3',
	S3_ENDPOINT: 'https://s3.example.com',
	S3_REGION: 'auto',
	S3_ACCESS_KEY_ID: 'access',
	S3_SECRET_ACCESS_KEY: 'secret',
	S3_BUCKET: 'bucket',
}

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
			envSchema.safeParse({
				...baseEnv,
				NODE_ENV: 'production',
				API_PROXY_SECRET: 'p'.repeat(32),
				...s3Env,
			}).success,
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
		expect(env.AI_TIMEOUT_MS).toBe(45_000)
		expect(env.AI_DAILY_MESSAGE_LIMIT).toBe(100)
		expect(envSchema.safeParse({ ...baseEnv, AI_DAILY_MESSAGE_LIMIT: '0' }).success).toBe(false)
	})

	it('defaults the daily photo limit to 30 and rejects a zero or fractional one', () => {
		expect(envSchema.parse(baseEnv).AI_DAILY_PHOTO_LIMIT).toBe(30)
		expect(envSchema.parse({ ...baseEnv, AI_DAILY_PHOTO_LIMIT: '5' }).AI_DAILY_PHOTO_LIMIT).toBe(5)
		expect(envSchema.safeParse({ ...baseEnv, AI_DAILY_PHOTO_LIMIT: '0' }).success).toBe(false)
		expect(envSchema.safeParse({ ...baseEnv, AI_DAILY_PHOTO_LIMIT: '1.5' }).success).toBe(false)
	})
})

describe('envSchema storage', () => {
	const productionEnv = { ...baseEnv, NODE_ENV: 'production', API_PROXY_SECRET: 'p'.repeat(32) }

	it('defaults the provider to memory and applies photo defaults', () => {
		const env = envSchema.parse(baseEnv)

		expect(env.STORAGE_PROVIDER).toBe('memory')
		expect(env.STORAGE_KEY_PREFIX).toBe('dev')
		expect(env.PHOTOS_PER_MESSAGE_MAX).toBe(6)
		expect(env.PHOTO_DAILY_UPLOAD_LIMIT).toBe(60)
		expect(env.PHOTO_ORPHAN_TTL_HOURS).toBe(24)
	})

	it('requires s3 in production', () => {
		expect(envSchema.safeParse(productionEnv).success).toBe(false)
		expect(envSchema.safeParse({ ...productionEnv, STORAGE_PROVIDER: 'memory' }).success).toBe(
			false,
		)
		expect(envSchema.safeParse({ ...productionEnv, ...s3Env }).success).toBe(true)
	})

	it.each(['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'])(
		'rejects s3 without %s',
		(name) => {
			const { [name]: _omitted, ...rest } = s3Env as Record<string, string>

			expect(envSchema.safeParse({ ...baseEnv, ...rest }).success).toBe(false)
			expect(envSchema.safeParse({ ...baseEnv, ...rest, [name]: '  ' }).success).toBe(false)
		},
	)

	it('does not require S3 variables for the memory provider', () => {
		expect(envSchema.safeParse({ ...baseEnv, STORAGE_PROVIDER: 'memory' }).success).toBe(true)
	})

	it('rejects an unknown provider', () => {
		expect(envSchema.safeParse({ ...baseEnv, STORAGE_PROVIDER: 'r2' }).success).toBe(false)
	})

	it('requires S3_ENDPOINT to be an https URL', () => {
		expect(
			envSchema.safeParse({ ...baseEnv, ...s3Env, S3_ENDPOINT: 'http://s3.example.com' }).success,
		).toBe(false)
		expect(envSchema.safeParse({ ...baseEnv, ...s3Env, S3_ENDPOINT: 'not a url' }).success).toBe(
			false,
		)
	})

	it('limits PHOTOS_PER_MESSAGE_MAX to 1..6', () => {
		expect(envSchema.safeParse({ ...baseEnv, PHOTOS_PER_MESSAGE_MAX: '0' }).success).toBe(false)
		expect(envSchema.safeParse({ ...baseEnv, PHOTOS_PER_MESSAGE_MAX: '7' }).success).toBe(false)
		expect(
			envSchema.parse({ ...baseEnv, PHOTOS_PER_MESSAGE_MAX: '6' }).PHOTOS_PER_MESSAGE_MAX,
		).toBe(6)
		expect(
			envSchema.parse({ ...baseEnv, PHOTOS_PER_MESSAGE_MAX: '1' }).PHOTOS_PER_MESSAGE_MAX,
		).toBe(1)
	})

	it('rejects a zero upload limit and orphan TTL', () => {
		expect(envSchema.safeParse({ ...baseEnv, PHOTO_DAILY_UPLOAD_LIMIT: '0' }).success).toBe(false)
		expect(envSchema.safeParse({ ...baseEnv, PHOTO_ORPHAN_TTL_HOURS: '0' }).success).toBe(false)
	})
})
