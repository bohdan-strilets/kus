import { answerClarificationRequestSchema, clarificationParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class ClarificationParamsDto extends createZodDto(clarificationParamsSchema) {}

export class AnswerClarificationDto extends createZodDto(answerClarificationRequestSchema) {}
