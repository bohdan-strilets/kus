import { updateMeRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateMeDto extends createZodDto(updateMeRequestSchema) {}
