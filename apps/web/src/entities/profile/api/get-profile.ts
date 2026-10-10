import { createDataResponseSchema, type ProfileResponse, profileResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const profileEnvelopeSchema = createDataResponseSchema(profileResponseSchema)

export const getProfile = async (): Promise<ProfileResponse> => {
	const response = await httpClient.get<unknown>('/profile')
	return profileEnvelopeSchema.parse(response.data).data
}
