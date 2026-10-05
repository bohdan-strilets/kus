import { z } from 'zod'

const envSchema = z.object({
	VITE_API_URL: z.url(),
})

/** Validated at startup so a missing VITE_API_URL fails loudly instead of as broken requests. */
export const env = envSchema.parse(import.meta.env)
