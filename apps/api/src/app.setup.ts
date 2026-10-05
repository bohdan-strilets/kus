import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'

import type { Env } from './config'

export const API_PREFIX = 'api/v1'

/** HTTP-level setup shared by main.ts and e2e tests, so tests hit the same pipeline as prod. */
export const setupApp = (app: INestApplication): void => {
	const config = app.get<ConfigService<Env, true>>(ConfigService)

	app.setGlobalPrefix(API_PREFIX)
	app.use(helmet())
	app.enableCors({
		origin: config.get('CORS_ORIGIN', { infer: true }),
		credentials: true,
	})
	app.enableShutdownHooks()
}
