import { rememberEntriesRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class RememberEntriesDto extends createZodDto(rememberEntriesRequestSchema) {}
