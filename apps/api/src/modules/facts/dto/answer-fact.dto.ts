import { answerFactRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class AnswerFactDto extends createZodDto(answerFactRequestSchema) {}
