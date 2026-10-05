import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'

import { AllExceptionsFilter } from './common/filters'
import { ResponseEnvelopeInterceptor } from './common/interceptors'
import { AppValidationPipe } from './common/pipes'
import { AppConfigModule } from './config'
import { HealthModule } from './modules/health/health.module'
import { PrismaModule } from './prisma'

@Module({
	imports: [AppConfigModule, PrismaModule, HealthModule],
	providers: [
		{ provide: APP_PIPE, useClass: AppValidationPipe },
		{ provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
})
export class AppModule {}
