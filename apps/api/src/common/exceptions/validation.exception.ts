import { HttpStatus } from '@nestjs/common'
import { ZodError } from 'zod'

import { AppException } from './app.exception'
import { ErrorCodes } from './error-codes'

const ROOT_FIELD = '_root'

const ISSUE_CODE_MAP: Record<string, string> = {
	too_big: 'TOO_LARGE',
	too_small: 'TOO_SMALL',
	invalid_type: 'INVALID_TYPE',
	invalid_format: 'INVALID_FORMAT',
	invalid_value: 'INVALID_VALUE',
	unrecognized_keys: 'UNKNOWN_FIELD',
}

const toFieldErrors = (error: unknown): Record<string, string> => {
	if (!(error instanceof ZodError)) return {}

	const fields: Record<string, string> = {}
	for (const issue of error.issues) {
		const field = issue.path.length > 0 ? issue.path.join('.') : ROOT_FIELD
		// the first issue per field is the most relevant one to show
		fields[field] ??= ISSUE_CODE_MAP[issue.code] ?? issue.code.toUpperCase()
	}
	return fields
}

/** 422 with per-field codes: `{ details: { fields: { grams: 'TOO_LARGE' } } }`. */
export class ValidationException extends AppException {
	constructor(zodError: unknown) {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: toFieldErrors(zodError) },
		})
	}
}
