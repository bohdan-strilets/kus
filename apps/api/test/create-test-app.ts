import type { INestApplication, Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { App } from 'supertest/types'

import { AppModule } from '../src/app.module'
import { setupApp } from '../src/app.setup'
import { PrismaService } from '../src/prisma'

interface CreateTestAppOptions {
	/** Extra controllers mounted next to AppModule, e.g. to exercise global pipes and filters. */
	controllers?: Type[]
}

/** Full app with the production HTTP pipeline; Prisma is stubbed so tests run without Postgres. */
export const createTestApp = async ({ controllers = [] }: CreateTestAppOptions = {}): Promise<
	INestApplication<App>
> => {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
		.overrideProvider(PrismaService)
		.useValue({})
		.compile()

	const app = moduleRef.createNestApplication<INestApplication<App>>()
	setupApp(app)
	await app.init()
	return app
}
