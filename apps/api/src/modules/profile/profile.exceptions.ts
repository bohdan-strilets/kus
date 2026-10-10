import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The calculation can't run yet: `fields` names what «Мої дані» still lacks. */
export class ProfileIncompleteException extends AppException {
	constructor(fields: string[]) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.PROFILE_INCOMPLETE,
			details: { fields },
		})
	}
}

/** Manual goals whose macros don't add up to the kcal; `macroKcal` is what they add up to. */
export class GoalsInconsistentException extends AppException {
	constructor(macroKcal: number) {
		super({
			status: HttpStatus.BAD_REQUEST,
			errorCode: ErrorCodes.GOALS_INCONSISTENT,
			details: { macroKcal },
		})
	}
}
