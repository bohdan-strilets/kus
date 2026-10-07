import { sendMessageRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class SendMessageDto extends createZodDto(sendMessageRequestSchema) {}
