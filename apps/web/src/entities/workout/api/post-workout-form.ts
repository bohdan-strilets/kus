import {
	createDataResponseSchema,
	type WorkoutFinished,
	type WorkoutForm,
	workoutFinishedSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(workoutFinishedSchema)

/** «Заповнити»: a finished session at once; a repeat of the same `clientRequestId` returns the first answer. */
export const postWorkoutForm = async (form: WorkoutForm): Promise<WorkoutFinished> => {
	const response = await httpClient.post<unknown>('/workout-forms', form)
	return responseSchema.parse(response.data).data
}
