import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

export class MessageInProgressException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.MESSAGE_IN_PROGRESS })
	}
}

export class ClientMessageIdReusedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.CLIENT_MESSAGE_ID_REUSED })
	}
}

/** Same shape as a zod failure, so the web app handles it like any other bad field. */
export class InvalidCursorException extends AppException {
	constructor() {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: { cursor: 'INVALID_CURSOR' } },
		})
	}
}
