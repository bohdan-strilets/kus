import { PHOTOS_PER_MESSAGE_LIMIT } from '@kus/shared'
import { z } from 'zod'

const DEFAULT_PORT = 3000
// HS256 key: 32+ chars so a captured token can't be brute-forced offline
const JWT_SECRET_MIN_LENGTH = 32
// 8000 output tokens at ~180–200 tokens/s ≈ 40–45 s: a long answer just fits; 2 attempts stay
// inside the whole-parse deadline (AI_PARSE_DEADLINE_MS, 95 s, under Vercel's 120 s proxy limit)
const DEFAULT_AI_TIMEOUT_MS = 45_000
// one attempt can't usefully run past the whole-parse deadline
const MAX_AI_TIMEOUT_MS = 95_000
const DEFAULT_AI_DAILY_MESSAGE_LIMIT = 100
// a photo costs about 2.5× a text request: 30 a day caps it at ≈ $0.45
const DEFAULT_AI_DAILY_PHOTO_LIMIT = 30
// a shared secret between Vercel and the API: as long as a JWT key, for the same reason
const PROXY_SECRET_MIN_LENGTH = 32
// uploads (including ones later left unattached) are cheap but not free: twice the AI limit
const DEFAULT_PHOTO_DAILY_UPLOAD_LIMIT = 60
const DEFAULT_PHOTO_ORPHAN_TTL_HOURS = 24
const DEFAULT_STORAGE_KEY_PREFIX = 'dev'
const S3_REQUIRED_VARS = [
	'S3_ENDPOINT',
	'S3_REGION',
	'S3_ACCESS_KEY_ID',
	'S3_SECRET_ACCESS_KEY',
	'S3_BUCKET',
] as const

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
		// photos per user per local day; a photo message counts in both limits
		AI_DAILY_PHOTO_LIMIT: z.coerce.number().int().positive().default(DEFAULT_AI_DAILY_PHOTO_LIMIT),
		// photos live in object storage; 'memory' is for dev and tests (unset → 'memory' outside
		// production). 's3' is any S3-compatible provider (Cloudflare R2, Backblaze B2, ...)
		STORAGE_PROVIDER: z.enum(['s3', 'memory']).optional(),
		// separates environments inside one bucket: <prefix>/users/<userId>/...
		STORAGE_KEY_PREFIX: z.string().trim().min(1).default(DEFAULT_STORAGE_KEY_PREFIX),
		// full URL without the bucket, e.g. https://<account>.eu.r2.cloudflarestorage.com
		S3_ENDPOINT: z.url({ protocol: /^https$/ }).optional(),
		// R2 uses 'auto'; B2 uses e.g. 'eu-central-003'
		S3_REGION: z.string().trim().min(1).optional(),
		S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
		S3_BUCKET: z.string().trim().min(1).optional(),
		// can only lower the shared hard ceiling, which the request schema and the UI texts use
		PHOTOS_PER_MESSAGE_MAX: z.coerce
			.number()
			.int()
			.min(1)
			.max(PHOTOS_PER_MESSAGE_LIMIT)
			.default(PHOTOS_PER_MESSAGE_LIMIT),
		// uploaded photos per user per local day
		PHOTO_DAILY_UPLOAD_LIMIT: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULT_PHOTO_DAILY_UPLOAD_LIMIT),
		// an upload nobody attached to a message is deleted after this long
		PHOTO_ORPHAN_TTL_HOURS: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULT_PHOTO_ORPHAN_TTL_HOURS),
		JWT_ACCESS_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH),
		// v0.1 is single-user: open only to create the owner account, then closed on prod
		ALLOW_REGISTRATION: z.stringbool().default(false),
		// unset = host-only cookies; the web app reaches the API via a same-origin rewrite (docs/architecture.md)
		COOKIE_DOMAIN: z.string().trim().min(1).optional(),
		// Vercel's rewrite adds it to every /api request; without it the API answers 404. Required in
		// production, so the Railway domain can't be called directly with a forged client IP
		API_PROXY_SECRET: z.string().trim().min(PROXY_SECRET_MIN_LENGTH).optional(),
	})
	.refine((env) => env.NODE_ENV !== 'production' || env.API_PROXY_SECRET !== undefined, {
		path: ['API_PROXY_SECRET'],
		message: 'Required in production',
	})
	.superRefine((env, context) => {
		if (env.NODE_ENV === 'production' && env.STORAGE_PROVIDER !== 's3') {
			context.addIssue({
				code: 'custom',
				path: ['STORAGE_PROVIDER'],
				message: 'Must be s3 in production',
			})
		}
		if (env.STORAGE_PROVIDER !== 's3') return
		for (const name of S3_REQUIRED_VARS) {
			if (env[name] !== undefined) continue
			context.addIssue({
				code: 'custom',
				path: [name],
				message: 'Required when STORAGE_PROVIDER=s3',
			})
		}
	})
	.transform((env) => ({
		...env,
		STORAGE_PROVIDER: env.STORAGE_PROVIDER ?? ('memory' as const),
		AI_MODEL_VISION: env.AI_MODEL_VISION ?? env.AI_MODEL,
		AI_MODEL_CHAT: env.AI_MODEL_CHAT ?? env.AI_MODEL,
	}))

export type Env = z.infer<typeof envSchema>
