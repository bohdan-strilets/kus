import { foodEntryParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class FoodEntryParamsDto extends createZodDto(foodEntryParamsSchema) {}
