import { updateFoodEntryRequestSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateFoodEntryDto extends createZodDto(updateFoodEntryRequestSchema) {}
