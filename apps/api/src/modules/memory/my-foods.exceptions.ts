import { HttpStatus } from '@nestjs/common'

import { AppException, ErrorCodes } from '../../common/exceptions'

/** No active food with this id for this user — another user's reads the same, never 403. */
export class MyFoodNotFoundException extends AppException {
	constructor() {
		super({ status: HttpStatus.NOT_FOUND, errorCode: ErrorCodes.MY_FOOD_NOT_FOUND })
	}
}

/** The name is taken by another active food; the web app shows «Такий продукт уже є «…»». */
export class MyFoodExistsException extends AppException {
	constructor(existing: { id: string; name: string }) {
		super({
			status: HttpStatus.CONFLICT,
			errorCode: ErrorCodes.MY_FOOD_EXISTS,
			details: { existingId: existing.id, name: existing.name },
		})
	}
}
