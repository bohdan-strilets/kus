import { logRecipePortionRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class LogRecipePortionDto extends createZodDto(logRecipePortionRequestSchema) {}
