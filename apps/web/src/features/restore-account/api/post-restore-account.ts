import { type AuthUser, authUserSchema, createDataResponseSchema } from '@kus/shared'

import { httpClient } from '@/shared/api'

const responseSchema = createDataResponseSchema(authUserSchema)

export const postRestoreAccount = async (): Promise<AuthUser> => {
	const response = await httpClient.post<unknown>('/account/restore')
	return responseSchema.parse(response.data).data
}
