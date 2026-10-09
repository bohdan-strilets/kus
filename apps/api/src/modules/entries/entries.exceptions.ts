import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The context showed the entry a moment ago; another tab deleted or restored it since. */
export class EntryChangedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.ENTRY_CHANGED })
	}
}

/** No active entry with this id for this user — another user's entry reads the same, never 403. */
export class EntryNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.ENTRY_NOT_FOUND })
	}
}
