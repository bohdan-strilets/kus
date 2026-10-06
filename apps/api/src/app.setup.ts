import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

import type { Env } from './config'

export const API_PREFIX = 'api/v1'
const TRUSTED_PROXY_HOPS = 1

/** HTTP-level setup shared by main.ts and e2e tests, so tests hit the same pipeline as prod. */
export const setupApp = (app: NestExpressApplication): void => {
	const config = app.get<ConfigService<Env, true>>(ConfigService)

	app.setGlobalPrefix(API_PREFIX)
	if (config.get('NODE_ENV', { infer: true }) === 'production') {
		// Without it every client shares the proxy IP in the throttler. 1 hop fits only a direct
		// client → Railway path; behind the planned Vercel rewrite req.ip is Vercel's egress IP.
		// Deploy blocker, see docs/architecture.md («Відкрите перед деплоєм»)
		app.set('trust proxy', TRUSTED_PROXY_HOPS)
	}
	app.use(helmet())
	app.use(cookieParser())
	app.enableCors({
		origin: config.get('CORS_ORIGIN', { infer: true }),
		credentials: true,
	})
	app.enableShutdownHooks()
}
