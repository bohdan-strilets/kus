import {
	createDataResponseSchema,
	type ProfileResponse,
	profileResponseSchema,
	type UpdateProfileRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(profileResponseSchema)

/** One field at a time; the answer is the whole fresh profile. */
export const patchProfile = async (body: UpdateProfileRequest): Promise<ProfileResponse> => {
	const response = await httpClient.patch<unknown>('/profile', body)
	return responseSchema.parse(response.data).data
}
