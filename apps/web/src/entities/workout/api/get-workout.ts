import { createDataResponseSchema, type WorkoutResponse, workoutResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(workoutResponseSchema)

/** One live training of the user; somebody else's or a deleted one is a 404 WORKOUT_NOT_FOUND. */
export const getWorkout = async (workoutId: string): Promise<WorkoutResponse> => {
	const response = await httpClient.get<unknown>(`/workouts/${workoutId}`)
	return responseSchema.parse(response.data).data
}
