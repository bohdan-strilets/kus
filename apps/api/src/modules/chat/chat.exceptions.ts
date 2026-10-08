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

export class ClarificationNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.CLARIFICATION_NOT_FOUND })
	}
}

export class ClarificationAlreadyAnsweredException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.CLARIFICATION_ALREADY_ANSWERED })
	}
}

export class ClarificationNotApplicableException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.CLARIFICATION_NOT_APPLICABLE })
	}
}

/** The request allows up to 4 options; this question has fewer. */
export class OptionIndexOutOfRangeException extends AppException {
	constructor() {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: { optionIndex: 'TOO_LARGE' } },
		})
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
