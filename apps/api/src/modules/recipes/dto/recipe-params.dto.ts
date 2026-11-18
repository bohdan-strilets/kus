import { recipeParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class RecipeParamsDto extends createZodDto(recipeParamsSchema) {}
