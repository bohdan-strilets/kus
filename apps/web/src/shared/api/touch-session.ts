import { httpClient } from './http-client'

/**
 * The cheapest authenticated read (GET /users/me, no side effects). It goes through the axios
 * refresh interceptor, so an expired access token is renewed here — for resources that bypass axios
 * (<img src="/api/v1/photos/...">) and would otherwise keep failing with 401.
 * Resolves to false when the request failed (network, dead session); the caller decides what to do.
 */
export const touchSession = async (): Promise<boolean> => {
	try {
		await httpClient.get('/users/me')
		return true
	} catch {
		return false
	}
}
