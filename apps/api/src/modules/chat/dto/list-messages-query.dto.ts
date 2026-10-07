import { listMessagesQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class ListMessagesQueryDto extends createZodDto(listMessagesQuerySchema) {}
