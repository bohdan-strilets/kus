import { photoParamsSchema, photoQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class PhotoParamsDto extends createZodDto(photoParamsSchema) {}

export class PhotoQueryDto extends createZodDto(photoQuerySchema) {}
