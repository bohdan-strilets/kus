import { changePasswordRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class ChangePasswordDto extends createZodDto(changePasswordRequestSchema) {}
