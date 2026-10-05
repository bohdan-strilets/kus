import { Logger } from '@nestjs/common'

import { type Env, envSchema } from './env.schema'

/** Fails fast on boot: the server must not start with an invalid env. Values are never logged. */
export const validateEnv = (config: Record<string, unknown>): Env => {
	const result = envSchema.safeParse(config)
	if (result.success) return result.data

	const invalidKeys = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
	new Logger('Config').error(`Invalid environment variables: ${invalidKeys}`)
	throw new Error(`Invalid environment variables: ${invalidKeys}`)
}
