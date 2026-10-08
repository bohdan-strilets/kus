import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'

import { createProxyGate } from './common/proxy'
import type { Env } from './config'

export const API_PREFIX = 'api/v1'
const HEALTH_PATH = `/${API_PREFIX}/health`

/** HTTP-level setup shared by main.ts and e2e tests, so tests hit the same pipeline as prod. */
export const setupApp = (app: NestExpressApplication): void => {
	const config = app.get<ConfigService<Env, true>>(ConfigService)

	app.setGlobalPrefix(API_PREFIX)
	// first: the gate's 404s carry the same headers as every other answer
	app.use(helmet())
	// The client IP for the throttler comes from Vercel's header (common/proxy), not from
	// X-Forwarded-For, so `trust proxy` stays off: Railway's own hop must not decide req.ip
	const proxySecret = config.get('API_PROXY_SECRET', { infer: true })
	if (proxySecret !== undefined) {
		app.use(createProxyGate({ secret: proxySecret, exemptPaths: [HEALTH_PATH] }))
	}
	app.use(cookieParser())
	app.enableCors({
		origin: config.get('CORS_ORIGIN', { infer: true }),
		credentials: true,
	})
	app.enableShutdownHooks()
}
