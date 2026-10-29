import { createDataResponseSchema, type WorkoutResponse, workoutResponseSchema } from '@kus/shared'
import { z } from 'zod'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(z.array(workoutResponseSchema))

/** The workouts of one calendar day, in the order of the day. */
export const getWorkoutsOfDay = async (localDate: string): Promise<WorkoutResponse[]> => {
	const response = await httpClient.get<unknown>(`/workouts/day/${localDate}`)
	return responseSchema.parse(response.data).data
}

/** The workouts of [from, to], both `YYYY-MM-DD` in the user's zone. */
export const getWorkoutsInRange = async ({
	from,
	to,
}: {
	from: string
	to: string
}): Promise<WorkoutResponse[]> => {
	const response = await httpClient.get<unknown>('/workouts', { params: { from, to } })
	return responseSchema.parse(response.data).data
}
