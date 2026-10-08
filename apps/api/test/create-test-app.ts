import type { Type } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import { PrismaService } from '../src/prisma'

interface CreateTestAppOptions {
	/** Extra controllers mounted next to AppModule, e.g. to exercise global pipes and filters. */
	controllers?: Type[]
	/** false — the stubbed database refuses every query (the healthcheck's ping fails). */
	isDatabaseUp?: boolean
}

/** Full app with the production HTTP pipeline; Prisma is stubbed so tests run without Postgres. */
export const createTestApp = async ({
	controllers = [],
	isDatabaseUp = true,
}: CreateTestAppOptions = {}): Promise<NestExpressApplication> => {
	const prismaStub = {
		$queryRaw: () =>
			isDatabaseUp ? Promise.resolve([]) : Promise.reject(new Error('connection refused')),
	}
	const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
		.overrideProvider(PrismaService)
		.useValue(prismaStub)
		.compile()

	const app = moduleRef.createNestApplication<NestExpressApplication>()
	setupApp(app)
	await app.init()
	return app
}
