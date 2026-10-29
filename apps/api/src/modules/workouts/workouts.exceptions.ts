import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/**
 * The day of a workout is outside today and the days that can be logged back: the parser rejects it,
 * so reaching this is a bug, and the turn rolls back.
 */
export class WorkoutDateOutOfRangeException extends AppException {
	constructor() {
		super({ status: HttpStatus.INTERNAL_SERVER_ERROR, errorCode: ErrorCodes.INTERNAL_ERROR })
	}
}

/** No such workout for this user — another user's reads the same, never 403. */
export class WorkoutNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.WORKOUT_NOT_FOUND })
	}
}
