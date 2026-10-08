import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

export class DatabaseUnavailableException extends AppException {
	constructor() {
		super({
			status: HttpStatus.SERVICE_UNAVAILABLE,
			errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
		})
	}
}
