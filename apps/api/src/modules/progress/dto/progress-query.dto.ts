import { progressQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class ProgressQueryDto extends createZodDto(progressQuerySchema) {}
