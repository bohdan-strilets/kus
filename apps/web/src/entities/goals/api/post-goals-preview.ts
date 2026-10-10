import {
	createDataResponseSchema,
	type GoalsPreviewResponse,
	goalsPreviewResponseSchema,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const previewEnvelopeSchema = createDataResponseSchema(goalsPreviewResponseSchema)

/** The calculation from the saved profile, without saving; 409 PROFILE_INCOMPLETE when it can't run. */
export const postGoalsPreview = async (): Promise<GoalsPreviewResponse> => {
	const response = await httpClient.post<unknown>('/profile/goals/preview')
	return previewEnvelopeSchema.parse(response.data).data
}
