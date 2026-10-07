import { z } from 'zod'

const DEFAULT_PORT = 3000
// HS256 key: 32+ chars so a captured token can't be brute-forced offline
const JWT_SECRET_MIN_LENGTH = 32
// 8000 output tokens at ~180–200 tokens/s ≈ 45 s: a long answer must hit max_tokens, not the timeout
const DEFAULT_AI_TIMEOUT_MS = 60_000
const MAX_AI_TIMEOUT_MS = 120_000
const DEFAULT_AI_DAILY_MESSAGE_LIMIT = 100

/** Empty or unset → undefined; the transform below then falls back to AI_MODEL. */
const optionalModelSchema = z
	.string()
	.trim()
	.optional()
	.transform((value) => (value ? value : undefined))

export const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
		DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
		CORS_ORIGIN: z
			.string()
			.min(1)
			.transform((value) =>
				value
					.split(',')
					.map((origin) => origin.trim())
					.filter(Boolean),
			)
			// browsers send a bare origin, so "https://kus.app/" must become "https://kus.app" to match
			.pipe(
				z.array(z.url({ protocol: /^https?$/ }).transform((url) => new URL(url).origin)).min(1),
			),
		OPENROUTER_API_KEY: z.string().min(1),
		// default model; the purpose-specific ones fall back to it when empty
		AI_MODEL: z.string().trim().min(1),
		AI_MODEL_VISION: optionalModelSchema,
		AI_MODEL_CHAT: optionalModelSchema,
		// per attempt; the SDK retries a network error once
		AI_TIMEOUT_MS: z.coerce
			.number()
			.int()
			.min(1000)
			.max(MAX_AI_TIMEOUT_MS)
			.default(DEFAULT_AI_TIMEOUT_MS),
		// AI requests per user per local day — guards the OpenRouter budget
		AI_DAILY_MESSAGE_LIMIT: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULT_AI_DAILY_MESSAGE_LIMIT),
		JWT_ACCESS_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH),
		// v0.1 is single-user: open only to create the owner account, then closed on prod
		ALLOW_REGISTRATION: z.stringbool().default(false),
		// unset = host-only cookies; the web app reaches the API via a same-origin rewrite (docs/architecture.md)
		COOKIE_DOMAIN: z.string().trim().min(1).optional(),
	})
	.transform((env) => ({
		...env,
		AI_MODEL_VISION: env.AI_MODEL_VISION ?? env.AI_MODEL,
		AI_MODEL_CHAT: env.AI_MODEL_CHAT ?? env.AI_MODEL,
	}))

export type Env = z.infer<typeof envSchema>
