import { myFoodsQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class MyFoodsQueryDto extends createZodDto(myFoodsQuerySchema) {}
