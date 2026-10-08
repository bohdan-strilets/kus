import { setGoalRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class SetGoalDto extends createZodDto(setGoalRequestSchema) {}
