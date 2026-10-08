import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** Same shape as a zod failure: a day after tomorrow has nothing logged and never will yet. */
export class DayInFutureException extends AppException {
	constructor() {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: { localDate: 'IN_FUTURE' } },
		})
	}
}
