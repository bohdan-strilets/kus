import { ConfigService } from '@nestjs/config'
import { PHOTO_MAX_BASE64_LENGTH, PHOTO_THUMB_MAX_BASE64_LENGTH } from '@kus/shared'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'

import { createProxyGate } from './common/proxy'
import type { Env } from './config'

export const API_PREFIX = 'api/v1'
const HEALTH_PATH = `/${API_PREFIX}/health`
const MESSAGES_PATH = `/${API_PREFIX}/messages`
const PHOTOS_PATH = `/${API_PREFIX}/photos`
const DEFAULT_BODY_LIMIT = '100kb'
// a photo of up to 1.4 MB as base64 (≈ 1.87 MB) plus the text
const MESSAGES_BODY_LIMIT = '2mb'
const JSON_ENVELOPE_ALLOWANCE_BYTES = 16 * 1024
/**
 * POST /photos carries the full photo and its thumbnail as base64. It is the longest body the
 * request schema accepts plus room for the JSON around it, so the schema's own TOO_LARGE answers
 * first for any oversized file and the parser's 413 is left to bodies that are not a photo upload.
 */
export const PHOTOS_BODY_LIMIT_BYTES =
	PHOTO_MAX_BASE64_LENGTH + PHOTO_THUMB_MAX_BASE64_LENGTH + JSON_ENVELOPE_ALLOWANCE_BYTES

// Express routes ignore case and a trailing slash, so the parser lookup must too
const normalizePath = (path: string): string => path.replace(/\/+$/, '').toLowerCase()

/**
 * Nest's own parsers have one limit for every route; only POST /messages and POST /photos carry a
 * photo, so they get a big one and everything else keeps the small one.
 */
const useBodyParsers = (app: NestExpressApplication): void => {
	const defaultJson = express.json({ limit: DEFAULT_BODY_LIMIT })
	const photoParsers = new Map<string, express.RequestHandler>([
		[MESSAGES_PATH, express.json({ limit: MESSAGES_BODY_LIMIT })],
		[PHOTOS_PATH, express.json({ limit: PHOTOS_BODY_LIMIT_BYTES })],
	])
	app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
		const parseJson =
			(req.method === 'POST' ? photoParsers.get(normalizePath(req.path)) : undefined) ?? defaultJson
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
	app.enableCors({
		origin: config.get('CORS_ORIGIN', { infer: true }),
		credentials: true,
	})
	// after CORS: a 413 or a bad-JSON 400 from the parser must carry the CORS headers too
	useBodyParsers(app)
	app.enableShutdownHooks()
}
