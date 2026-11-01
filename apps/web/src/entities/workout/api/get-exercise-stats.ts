import {
	createDataResponseSchema,
	type ExerciseStatsResponse,
	exerciseStatsResponseSchema,
	type WorkoutStatsPeriod,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(exerciseStatsResponseSchema)

/** One exercise over the period; somebody else's or an unknown id is a 404. */
export const getExerciseStats = async ({
	exerciseId,
	period,
}: {
	exerciseId: string
	period: WorkoutStatsPeriod
}): Promise<ExerciseStatsResponse> => {
	const response = await httpClient.get<unknown>(`/workouts/exercises/${exerciseId}`, {
		params: { period },
	})
	return responseSchema.parse(response.data).data
}
