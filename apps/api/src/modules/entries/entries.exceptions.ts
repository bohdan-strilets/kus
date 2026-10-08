import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The context showed the entry a moment ago; another tab deleted or restored it since. */
export class EntryChangedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.ENTRY_CHANGED })
	}
}
