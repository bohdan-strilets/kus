import { myFoodParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class MyFoodParamsDto extends createZodDto(myFoodParamsSchema) {}
