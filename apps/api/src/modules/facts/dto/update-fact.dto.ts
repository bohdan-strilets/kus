import { updateFactRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateFactDto extends createZodDto(updateFactRequestSchema) {}
