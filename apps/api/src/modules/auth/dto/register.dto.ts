import { registerRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class RegisterDto extends createZodDto(registerRequestSchema) {}
