import {
	createDataResponseSchema,
	type ExerciseDictionaryQuery,
	type ExerciseDictionaryResponse,
	exerciseDictionaryResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(exerciseDictionaryResponseSchema)

/** The user's exercises with the last result of each, narrowed by a part of the name and a group. */
export const getExerciseDictionary = async (
	params: ExerciseDictionaryQuery,
): Promise<ExerciseDictionaryResponse> => {
	const response = await httpClient.get<unknown>('/workouts/exercises', { params })
	return responseSchema.parse(response.data).data
}
