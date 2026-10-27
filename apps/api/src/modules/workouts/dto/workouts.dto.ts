import { workoutDayParamsSchema, workoutParamsSchema, workoutsRangeQuerySchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class WorkoutParamsDto extends createZodDto(workoutParamsSchema) {}

export class WorkoutDayParamsDto extends createZodDto(workoutDayParamsSchema) {}

export class WorkoutsRangeQueryDto extends createZodDto(workoutsRangeQuerySchema) {}
