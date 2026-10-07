import { type AuthUser, authUserSchema, createDataResponseSchema } from '@kus/shared'

import { httpClient, isUnauthorizedError } from '@/shared/api'

const meEnvelopeSchema = createDataResponseSchema(authUserSchema)

/**
 * The current user, or null when there is no session. A 401 has already been through one refresh
 * (shared/api interceptor), so here it really means «not logged in» — a state, not an error.
 */
export const getMe = async (): Promise<AuthUser | null> => {
	try {
		const response = await httpClient.get<unknown>('/users/me')
		return meEnvelopeSchema.parse(response.data).data
	} catch (error) {
		if (isUnauthorizedError(error)) return null
		throw error
	}
}
