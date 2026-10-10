import { deleteAccountRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class DeleteAccountDto extends createZodDto(deleteAccountRequestSchema) {}
