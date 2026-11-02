import {
	liveWorkoutParamsSchema,
	liveWorkoutStartSchema,
	liveWorkoutUpdateSchema,
	workoutFormSchema,
} from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class LiveWorkoutParamsDto extends createZodDto(liveWorkoutParamsSchema) {}

export class LiveWorkoutStartDto extends createZodDto(liveWorkoutStartSchema) {}

export class LiveWorkoutUpdateDto extends createZodDto(liveWorkoutUpdateSchema) {}

export class WorkoutFormDto extends createZodDto(workoutFormSchema) {}
