import {
	createDataResponseSchema,
	type ProgressResponse,
	progressResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

import type { ProgressRange } from '../model/progress.types'

const responseSchema = createDataResponseSchema(progressResponseSchema)

/** Weight and waist over `range` days, plus the always-7-day calorie week and the insight facts. */
export const getProgress = async (range: ProgressRange): Promise<ProgressResponse> => {
	const response = await httpClient.get<unknown>('/progress', { params: { range } })
	return responseSchema.parse(response.data).data
}
