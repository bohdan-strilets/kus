import {
	createDataResponseSchema,
	profileGoalsSchema,
	type ProfileGoals,
	type SaveGoalsRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(profileGoalsSchema)

/** The goal from today on; earlier days keep theirs. */
export const putProfileGoals = async (body: SaveGoalsRequest): Promise<ProfileGoals> => {
	const response = await httpClient.put<unknown>('/profile/goals', body)
	return responseSchema.parse(response.data).data
}
