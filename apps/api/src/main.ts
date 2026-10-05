import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { setupApp } from './app.setup'
import type { Env } from './config'

const bootstrap = async (): Promise<void> => {
	const app = await NestFactory.create(AppModule)
	setupApp(app)

	const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true })
	await app.listen(port)
	new Logger('Bootstrap').log(`API listening on port ${port}`)
}

void bootstrap()
