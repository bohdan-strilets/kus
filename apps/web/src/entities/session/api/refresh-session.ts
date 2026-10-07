import { httpClient } from '@/shared/api'

/** Rotates both httpOnly cookies; 204 without a body. */
export const refreshSession = async (): Promise<void> => {
	await httpClient.post('/auth/refresh')
}
