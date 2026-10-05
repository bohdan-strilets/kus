import { type ArgumentMetadata, Injectable } from '@nestjs/common'
import { createZodValidationPipe } from 'nestjs-zod'

import { ValidationException } from '../exceptions'

/** Carries the zod error out of nestjs-zod, which doesn't pass the input to the exception factory. */
class ZodParseFailure extends Error {
	constructor(readonly zodError: unknown) {
		super('Zod parse failure')
	}
}

const ZodValidationPipe = createZodValidationPipe({
	createValidationException: (error) => new ZodParseFailure(error),
})

/**
 * nestjs-zod pipe that reports failures as our 422 VALIDATION_ERROR (instead of its own 400),
 * with the raw input attached so missing fields come back as REQUIRED.
 */
@Injectable()
export class AppValidationPipe extends ZodValidationPipe {
	override transform(value: unknown, metadata: ArgumentMetadata): unknown {
		try {
			return super.transform(value, metadata)
		} catch (error) {
			if (!(error instanceof ZodParseFailure)) throw error
			throw new ValidationException({ zodError: error.zodError, input: value })
		}
	}
}
