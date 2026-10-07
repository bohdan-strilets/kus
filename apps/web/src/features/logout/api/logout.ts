import { httpClient } from '@/shared/api'

/** Revokes the session on the server and clears both httpOnly cookies; 204. */
export const logout = async (): Promise<void> => {
	await httpClient.post('/auth/logout')
}
