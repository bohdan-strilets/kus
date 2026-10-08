import {
	createDataResponseSchema,
	type DailyGoal,
	dailyGoalSchema,
	type SetGoalRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(dailyGoalSchema)

/** The goal from today on; earlier days keep theirs. */
export const putCurrentGoal = async (body: SetGoalRequest): Promise<DailyGoal> => {
	const response = await httpClient.put<unknown>('/goals/current', body)
	return responseSchema.parse(response.data).data
}
