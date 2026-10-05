import { createZodValidationPipe } from 'nestjs-zod'

import { ValidationException } from '../exceptions'

/** nestjs-zod pipe that reports failures as our 422 VALIDATION_ERROR instead of its own 400. */
export const AppValidationPipe = createZodValidationPipe({
	createValidationException: (error) => new ValidationException(error),
})
