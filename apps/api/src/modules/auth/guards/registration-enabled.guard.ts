import { type CanActivate, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../../config'
import { RegistrationDisabledException } from '../auth.exceptions'

/** A guard, not a service check: guards run before pipes, so a closed registration is 403 for any body. */
@Injectable()
export class RegistrationEnabledGuard implements CanActivate {
	constructor(private readonly config: ConfigService<Env, true>) {}

	canActivate(): boolean {
		if (!this.config.get('ALLOW_REGISTRATION', { infer: true })) {
			throw new RegistrationDisabledException()
		}
		return true
	}
}
