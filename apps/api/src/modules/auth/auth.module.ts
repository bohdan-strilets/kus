import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'

import type { Env } from '../../config'
import { UsersModule } from '../users/users.module'
import { AuthCookieService } from './auth-cookie.service'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RegistrationEnabledGuard } from './guards/registration-enabled.guard'
import { PasswordService } from './password.service'
import { SessionService } from './session.service'
import { TokenService } from './token.service'

const JWT_ALGORITHM = 'HS256'

@Module({
	imports: [
		UsersModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<Env, true>) => ({
				secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
				signOptions: { algorithm: JWT_ALGORITHM },
				// pinned so a token can't pick its own algorithm (e.g. "none")
				verifyOptions: { algorithms: [JWT_ALGORITHM] },
			}),
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		SessionService,
		AuthRepository,
		AuthCookieService,
		PasswordService,
		TokenService,
		JwtAuthGuard,
		RegistrationEnabledGuard,
	],
	// the guard is registered globally in AppModule, which resolves it from here
	exports: [JwtAuthGuard],
})
export class AuthModule {}
