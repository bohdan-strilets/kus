import { measurementParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class MeasurementParamsDto extends createZodDto(measurementParamsSchema) {}
