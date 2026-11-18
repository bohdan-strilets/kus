import { recipesQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class RecipesQueryDto extends createZodDto(recipesQuerySchema) {}
