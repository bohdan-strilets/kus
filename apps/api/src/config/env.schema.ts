import { z } from 'zod'

const DEFAULT_PORT = 3000

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
		.pipe(z.array(z.url()).min(1)),
	OPENROUTER_API_KEY: z.string().min(1),
	AI_MODEL: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>
