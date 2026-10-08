import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import type { Request } from 'express'

import { AllExceptionsFilter } from './common/filters'
import { ResponseEnvelopeInterceptor } from './common/interceptors'
import { AppValidationPipe } from './common/pipes'
import { getClientIp } from './common/proxy'
import { AppConfigModule, type Env } from './config'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { ChatModule } from './modules/chat/chat.module'
import { DaysModule } from './modules/days/days.module'
import { HealthModule } from './modules/health/health.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma'

/** Per IP for every route; auth routes tighten it with @Throttle. In-memory: the API runs as one instance. */
const DEFAULT_THROTTLE = { ttl: minutes(1), limit: 100 }

@Module({
	imports: [
		AppConfigModule,
		PrismaModule,
		ThrottlerModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<Env, true>) => {
				const isBehindProxy = config.get('API_PROXY_SECRET', { infer: true }) !== undefined
				return {
					throttlers: [DEFAULT_THROTTLE],
					// the throttler types the request loosely; on the Express platform it is Express's Request
					getTracker: (request: Record<string, unknown>) =>
						getClientIp(request as unknown as Request, { isBehindProxy }),
				}
			},
		}),
		// daily cleanup of old AI tool calls
		ScheduleModule.forRoot(),
		HealthModule,
		AuthModule,
		UsersModule,
		ChatModule,
		DaysModule,
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
