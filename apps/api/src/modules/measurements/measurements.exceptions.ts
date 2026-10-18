import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** No such measurement for this user — another user's reads the same, never 403. */
export class MeasurementNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.MEASUREMENT_NOT_FOUND })
	}
}

/** The edited value is outside the bounds of its kind: 422 on the `value` field. */
export class MeasurementValueOutOfRangeException extends AppException {
	constructor(fieldCode: 'TOO_SMALL' | 'TOO_LARGE') {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: { value: fieldCode } },
		})
	}
}
