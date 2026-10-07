import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

export class AiUnavailableException extends AppException {
	constructor() {
		super({ status: HttpStatus.SERVICE_UNAVAILABLE, errorCode: ErrorCodes.AI_UNAVAILABLE })
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
