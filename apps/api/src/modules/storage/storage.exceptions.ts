import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

export class StorageUnavailableException extends AppException {
	constructor() {
		super({
			status: HttpStatus.SERVICE_UNAVAILABLE,
			errorCode: ErrorCodes.STORAGE_UNAVAILABLE,
		})
	}
}
