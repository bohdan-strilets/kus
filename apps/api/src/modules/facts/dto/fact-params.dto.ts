import { factParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class FactParamsDto extends createZodDto(factParamsSchema) {}
