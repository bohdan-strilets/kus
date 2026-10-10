import { createDataResponseSchema, type ProfileGoals, profileGoalsSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(profileGoalsSchema)

/** Saves the calculation from the profile as the goal from today on. */
export const putCalculatedGoals = async (): Promise<ProfileGoals> => {
	const response = await httpClient.put<unknown>('/profile/goals', { source: 'calculated' })
	return responseSchema.parse(response.data).data
}
