import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'

import { createProxyGate } from './common/proxy'
import type { Env } from './config'

export const API_PREFIX = 'api/v1'
const HEALTH_PATH = `/${API_PREFIX}/health`
const MESSAGES_PATH = `/${API_PREFIX}/messages`
const DEFAULT_BODY_LIMIT = '100kb'
// a photo of up to 1.4 MB as base64 (≈ 1.87 MB) plus the text
const MESSAGES_BODY_LIMIT = '2mb'

const isSendMessageRequest = (req: express.Request): boolean =>
	req.method === 'POST' && req.path === MESSAGES_PATH

/**
 * Nest's own parsers have one limit for every route; only POST /messages carries a photo, so it
 * gets the big one and everything else keeps the small one.
 */
const useBodyParsers = (app: NestExpressApplication): void => {
	const messagesJson = express.json({ limit: MESSAGES_BODY_LIMIT })
	const defaultJson = express.json({ limit: DEFAULT_BODY_LIMIT })
	app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
		const parseJson = isSendMessageRequest(req) ? messagesJson : defaultJson
		parseJson(req, res, next)
	})
	app.use(express.urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }))
}

/**
 * HTTP-level setup shared by main.ts and e2e tests, so tests hit the same pipeline as prod. The app
 * must be created with `bodyParser: false` (see useBodyParsers).
 */
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
	useBodyParsers(app)
	app.enableCors({
		origin: config.get('CORS_ORIGIN', { infer: true }),
		credentials: true,
	})
	app.enableShutdownHooks()
}
