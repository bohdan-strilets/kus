import { HttpStatus } from '@nestjs/common'
import { FACTS_MAX } from '@kus/shared'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** No such fact for this user (or not in the state the route needs) — another user's reads the same, never 403. */
export class FactNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.FACT_NOT_FOUND })
	}
}

/** Another active fact of the user has the same text. */
export class FactExistsException extends AppException {
	constructor(existingId: string) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.FACT_EXISTS,
			details: { existingId },
		})
	}
}

export class FactsLimitReachedException extends AppException {
	constructor() {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.FACTS_LIMIT_REACHED,
			details: { max: FACTS_MAX },
		})
	}
}

/** «Так / Ні» was already answered the other way. */
export class FactNotProposedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.FACT_NOT_PROPOSED })
	}
}
