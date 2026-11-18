import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** No active recipe with this id for this user — another user's reads the same, never 403. */
export class RecipeNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.RECIPE_NOT_FOUND })
	}
}

/** The name is taken by another active recipe (restore); details: { existingId, name }. */
export class RecipeNameTakenException extends AppException {
	constructor(existing: { id: string; name: string }) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.RECIPE_NAME_TAKEN,
			details: { existingId: existing.id, name: existing.name },
		})
	}
}

/** The portion can't be a valid entry: over 5000 g or denser than 9.5 kcal/g. */
export class RecipePortionInvalidException extends AppException {
	constructor() {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.RECIPE_PORTION_INVALID,
		})
	}
}
