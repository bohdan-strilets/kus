import { ConfigService } from '@nestjs/config'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import type { Env } from '../src/config'
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
		.compile()

	const app = moduleRef.createNestApplication<NestExpressApplication>()
	setupApp(app)
	await app.init()

	const prisma = app.get(PrismaService)
	if (shouldResetDatabase) await resetDatabase(prisma)
	return { app, prisma }
}
