import {
	type AuthUser,
	authSessionResponseSchema,
	createDataResponseSchema,
	type LoginRequest,
	type RegisterRequest,
} from '@kus/shared'

import { httpClient } from '@/shared/api'

const sessionEnvelopeSchema = createDataResponseSchema(authSessionResponseSchema)

/** The API sets the httpOnly cookies itself; the body carries only the user. */
export const login = async (body: LoginRequest): Promise<AuthUser> => {
	const response = await httpClient.post<unknown>('/auth/login', body)
	return sessionEnvelopeSchema.parse(response.data).data.user
}

export const register = async (body: RegisterRequest): Promise<AuthUser> => {
	const response = await httpClient.post<unknown>('/auth/register', body)
	return sessionEnvelopeSchema.parse(response.data).data.user
}
