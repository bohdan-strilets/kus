import { dayParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class DayParamsDto extends createZodDto(dayParamsSchema) {}
