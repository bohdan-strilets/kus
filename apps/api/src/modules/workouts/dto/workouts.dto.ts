import {
	exerciseStatsParamsSchema,
	workoutDayParamsSchema,
	workoutParamsSchema,
	workoutsRangeQuerySchema,
	workoutStatsQuerySchema,
} from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class WorkoutParamsDto extends createZodDto(workoutParamsSchema) {}

export class WorkoutDayParamsDto extends createZodDto(workoutDayParamsSchema) {}

export class WorkoutsRangeQueryDto extends createZodDto(workoutsRangeQuerySchema) {}

export class WorkoutStatsQueryDto extends createZodDto(workoutStatsQuerySchema) {}

export class ExerciseStatsParamsDto extends createZodDto(exerciseStatsParamsSchema) {}
