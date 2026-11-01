import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** The user has no active program - another user's reads the same, never 403. */
export class ProgramNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.PROGRAM_NOT_FOUND })
	}
}

/** The template is not in the active version of the user's program (a stale or foreign id). */
export class ProgramTemplateNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.PROGRAM_TEMPLATE_NOT_FOUND })
	}
}

/** The change was made against a version that is not the active one any more. */
export class ProgramVersionConflictException extends AppException {
	constructor(activeVersionId: string | null) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.PROGRAM_VERSION_CONFLICT,
			details: { activeVersionId },
		})
	}
}

/** No proposal with this message id for this user (another user's reads the same). */
export class ProgramProposalNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.PROGRAM_PROPOSAL_NOT_FOUND })
	}
}

export class ProgramProposalAlreadyAcceptedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.PROGRAM_PROPOSAL_ALREADY_ACCEPTED })
	}
}

export class ProgramProposalReplacedException extends AppException {
	constructor() {
		super({ status: HttpStatus.CONFLICT, errorCode: ErrorCodes.PROGRAM_PROPOSAL_REPLACED })
	}
}

export class ProgramProposalInvalidException extends AppException {
	constructor() {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.PROGRAM_PROPOSAL_INVALID,
		})
	}
}
