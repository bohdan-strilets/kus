import { HttpStatus } from '@nestjs/common'
import type { LiveConflictReason } from '@kus/shared'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The chat replaced the live session (EDITED) or finished it (FINISHED); the client reads it again. */
export class WorkoutLiveConflictException extends AppException {
	constructor(reason: LiveConflictReason) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.WORKOUT_LIVE_CONFLICT,
			details: { reason },
		})
	}
}

export type LoggingFieldCode = 'TOO_OLD' | 'IN_FUTURE' | 'TOO_SMALL' | 'DUPLICATE'

/** Same shape as a zod failure: a day out of the form's range, a start in the future, keys twice. */
export class WorkoutLoggingFieldException extends AppException {
	constructor(field: string, code: LoggingFieldCode) {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: { [field]: code } },
		})
	}
}
