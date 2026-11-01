import {
	createDataResponseSchema,
	type WorkoutStatsPeriod,
	type WorkoutStatsResponse,
	workoutStatsResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(workoutStatsResponseSchema)

/** The training stats of the period that ends today in the user's zone. */
export const getWorkoutStats = async (
	period: WorkoutStatsPeriod,
): Promise<WorkoutStatsResponse> => {
	const response = await httpClient.get<unknown>('/workouts/stats', { params: { period } })
	return responseSchema.parse(response.data).data
}
