import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The account is waiting to be purged; `purgeAt` lets account-restore show the date. */
export class AccountPendingDeletionException extends AppException {
	constructor(purgeAt: Date) {
		super({
			status: HttpStatus.FORBIDDEN,
			errorCode: ErrorCodes.ACCOUNT_PENDING_DELETION,
			details: { purgeAt: purgeAt.toISOString() },
		})
	}
}
