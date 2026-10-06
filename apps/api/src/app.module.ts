import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { AllExceptionsFilter } from './common/filters'
import { ResponseEnvelopeInterceptor } from './common/interceptors'
import { AppValidationPipe } from './common/pipes'
import { AppConfigModule } from './config'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { HealthModule } from './modules/health/health.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma'

/** Per IP for every route; auth routes tighten it with @Throttle. In-memory: the API runs as one instance. */
const DEFAULT_THROTTLE = { ttl: minutes(1), limit: 100 }

@Module({
	imports: [
		AppConfigModule,
		PrismaModule,
		ThrottlerModule.forRoot([DEFAULT_THROTTLE]),
		HealthModule,
		AuthModule,
		UsersModule,
	],
	providers: [
		// order matters: rate limiting runs before auth, so unauthenticated floods are limited too
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		{ provide: APP_GUARD, useExisting: JwtAuthGuard },
		{ provide: APP_PIPE, useClass: AppValidationPipe },
		{ provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
})
export class AppModule {}
