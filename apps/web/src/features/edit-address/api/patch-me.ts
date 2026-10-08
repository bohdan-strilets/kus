import {
	type AuthUser,
	authUserSchema,
	createDataResponseSchema,
	type UpdateMeRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(authUserSchema)

export const patchMe = async (body: UpdateMeRequest): Promise<AuthUser> => {
	const response = await httpClient.patch<unknown>('/users/me', body)
	return responseSchema.parse(response.data).data
}
