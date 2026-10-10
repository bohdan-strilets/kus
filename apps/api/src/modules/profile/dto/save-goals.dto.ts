import { saveGoalsRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class SaveGoalsDto extends createZodDto(saveGoalsRequestSchema) {}
