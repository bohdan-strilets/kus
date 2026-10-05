import { HttpStatus } from '@nestjs/common'
import { ZodError } from 'zod'

import { AppException } from './app.exception'
import { ErrorCodes } from './error-codes'

const ROOT_FIELD = '_root'
const REQUIRED = 'REQUIRED'
const INVALID_VALUE = 'INVALID_VALUE'
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

const ISSUE_CODE_MAP: Record<string, string> = {
	too_big: 'TOO_LARGE',
	too_small: 'TOO_SMALL',
	invalid_type: 'INVALID_TYPE',
	invalid_format: 'INVALID_FORMAT',
	invalid_value: INVALID_VALUE,
	unrecognized_keys: 'UNKNOWN_FIELD',
}

type ZodIssue = ZodError['issues'][number]

const getValueAtPath = (input: unknown, path: readonly PropertyKey[]): unknown => {
	let current: unknown = input
	for (const key of path) {
		if (typeof current !== 'object' || current === null) return undefined
		current = Reflect.get(current, key)
	}
	return current
}

const toFieldCode = (issue: ZodIssue, input: unknown): string => {
	// zod reports a missing field as a type mismatch; only the raw input tells them apart
	if (issue.code === 'invalid_type' && getValueAtPath(input, issue.path) === undefined) {
		return REQUIRED
	}
	if (issue.code !== 'custom') return ISSUE_CODE_MAP[issue.code] ?? issue.code.toUpperCase()
	// `.refine()` issues carry our error code in `message` (e.g. KCAL_DENSITY_TOO_HIGH)
	return ERROR_CODE_PATTERN.test(issue.message) ? issue.message : INVALID_VALUE
}

const toFieldErrors = (error: unknown, input: unknown): Record<string, string> => {
	if (!(error instanceof ZodError)) return {}

	const fields: Record<string, string> = {}
	for (const issue of error.issues) {
		const field = issue.path.length > 0 ? issue.path.join('.') : ROOT_FIELD
		// the first issue per field is the most relevant one to show
		fields[field] ??= toFieldCode(issue, input)
	}
	return fields
}

interface ValidationExceptionOptions {
	zodError: unknown
	/** The value that failed validation; needed to tell a missing field from a wrong type. */
	input: unknown
}

/** 422 with per-field codes: `{ details: { fields: { grams: 'TOO_LARGE' } } }`. */
export class ValidationException extends AppException {
	constructor({ zodError, input }: ValidationExceptionOptions) {
		super({
			status: HttpStatus.UNPROCESSABLE_ENTITY,
			errorCode: ErrorCodes.VALIDATION_ERROR,
			details: { fields: toFieldErrors(zodError, input) },
		})
	}
}
