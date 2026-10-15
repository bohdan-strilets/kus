import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** Also the answer for another user's photo, so ids can't be probed. */
export class PhotoNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.PHOTO_NOT_FOUND })
	}
}

export class PhotoInUseException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.PHOTO_IN_USE })
	}
}
