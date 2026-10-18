import { updateMeasurementRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateMeasurementDto extends createZodDto(updateMeasurementRequestSchema) {}
