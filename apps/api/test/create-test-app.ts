import type { Type } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import { PrismaService } from '../src/prisma'

interface CreateTestAppOptions {
	/** Extra controllers mounted next to AppModule, e.g. to exercise global pipes and filters. */
	controllers?: Type[]
}

/** Full app with the production HTTP pipeline; Prisma is stubbed so tests run without Postgres. */
export const createTestApp = async ({
	controllers = [],
}: CreateTestAppOptions = {}): Promise<NestExpressApplication> => {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
		.overrideProvider(PrismaService)
		.useValue({})
		.compile()

	const app = moduleRef.createNestApplication<NestExpressApplication>()
	setupApp(app)
	await app.init()
	return app
}
