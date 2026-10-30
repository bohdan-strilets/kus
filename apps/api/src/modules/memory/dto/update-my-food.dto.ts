import { updateMyFoodRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateMyFoodDto extends createZodDto(updateMyFoodRequestSchema) {}
