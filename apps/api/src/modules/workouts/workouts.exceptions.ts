import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** No such workout for this user — another user's reads the same, never 403. */
export class WorkoutNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.WORKOUT_NOT_FOUND })
	}
}
