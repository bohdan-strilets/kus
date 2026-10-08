import { daysRangeQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class DaysRangeQueryDto extends createZodDto(daysRangeQuerySchema) {}
