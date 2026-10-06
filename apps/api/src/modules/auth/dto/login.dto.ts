import { loginRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class LoginDto extends createZodDto(loginRequestSchema) {}
