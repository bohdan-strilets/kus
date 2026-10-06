import { z } from 'zod'

const DEFAULT_PORT = 3000
// HS256 key: 32+ chars so a captured token can't be brute-forced offline
const JWT_SECRET_MIN_LENGTH = 32

export const envSchema = z.object({
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
		.pipe(z.array(z.url({ protocol: /^https?$/ }).transform((url) => new URL(url).origin)).min(1)),
	OPENROUTER_API_KEY: z.string().min(1),
	AI_MODEL: z.string().min(1),
	JWT_ACCESS_SECRET: z.string().min(JWT_SECRET_MIN_LENGTH),
	// v0.1 is single-user: open only to create the owner account, then closed on prod
	ALLOW_REGISTRATION: z.stringbool().default(false),
	// unset = host-only cookies; the web app reaches the API via a same-origin rewrite (docs/architecture.md)
	COOKIE_DOMAIN: z.string().trim().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>
