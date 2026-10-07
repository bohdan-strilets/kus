import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

export class AiUnavailableException extends AppException {
	constructor() {
		super({ status: HttpStatus.SERVICE_UNAVAILABLE, errorCode: ErrorCodes.AI_UNAVAILABLE })
	}
}

/** Not 503: a resend of the same text would be cut again, so the client asks to split it instead. */
export class MessageTooLongException extends AppException {
	constructor() {
		super({ status: HttpStatus.UNPROCESSABLE_ENTITY, errorCode: ErrorCodes.MESSAGE_TOO_LONG })
	}
}

export class DailyLimitReachedException extends AppException {
	constructor(limit: number) {
		super({
			status: HttpStatus.TOO_MANY_REQUESTS,
			errorCode: ErrorCodes.DAILY_LIMIT_REACHED,
			details: { limit },
		})
	}
}
