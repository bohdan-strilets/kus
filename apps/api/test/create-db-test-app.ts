import { inspect } from 'node:util'
import type { LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import type { Env } from '../src/config'
import type { AiClient } from '../src/modules/ai/ai-client'
import { AI_CLIENT } from '../src/modules/ai/ai.constants'
import { validateEnv } from '../src/config/validate-env'
import { PrismaService } from '../src/prisma'
import { assertSafeTestDatabase, resetDatabase } from './test-database'

interface CreateDbTestAppOptions {
	/** Raw env values (as strings), validated by the real env schema. */
	env?: Record<string, string>
	/**
	 * false = keep the data of a previous app in the same test. A second app also has a fresh
	 * in-memory throttler, which lets a test go past the per-minute login limit.
	 */
	shouldResetDatabase?: boolean
	/** Replaces the OpenRouter client; tests must never call the real model. */
	aiClient?: AiClient
	/** Replaces Nest's logger, e.g. to check that nothing sensitive reaches the logs. */
	logger?: LoggerService
}

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal'

/** Collects every line of every level as one string (the message plus its params, inspected). */
export const createCapturingLogger = (): LoggerService & { lines: string[] } => {
	const lines: string[] = []
	const capture =
		(level: LogLevel) =>
		(message: unknown, ...params: unknown[]): void => {
			const parts = [String(message), ...params.map((param) => inspect(param, { depth: 6 }))]
			lines.push(`${level}: ${parts.join(' ')}`)
		}
	return {
		lines,
		log: capture('log'),
		error: capture('error'),
		warn: capture('warn'),
		debug: capture('debug'),
		verbose: capture('verbose'),
		fatal: capture('fatal'),
	}
}

const UNCONFIGURED_AI_CLIENT: AiClient = {
	post: () => Promise.reject(new Error('AI client is not configured in this test')),
}

export interface DbTestApp {
	app: NestExpressApplication
	prisma: PrismaService
}

/**
 * Full app with the production HTTP pipeline on the real test DB (see db-global-setup.ts).
 * The DB is emptied first, so each app starts from a clean state (test files run sequentially,
 * see `fileParallelism` in vitest.config.mts).
 */
export const createDbTestApp = async ({
	env = {},
	shouldResetDatabase = true,
	aiClient = UNCONFIGURED_AI_CLIENT,
	logger,
}: CreateDbTestAppOptions = {}): Promise<DbTestApp> => {
	// ConfigModule validates env once at import time; a per-app env needs its own ConfigService
	const config = validateEnv({ ...process.env, ...env })
	// an env override must not point the truncating helper at a remote database
	assertSafeTestDatabase(config.DATABASE_URL)
	const configService = {
		get: <K extends keyof Env>(key: K): Env[K] => config[key],
	}

	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		.overrideProvider(ConfigService)
		.useValue(configService)
		.overrideProvider(AI_CLIENT)
		.useValue(aiClient)
		.compile()

	const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false })
	if (logger) app.useLogger(logger)
	setupApp(app)
	await app.init()

	const prisma = app.get(PrismaService)
	if (shouldResetDatabase) await resetDatabase(prisma)
	return { app, prisma }
}
