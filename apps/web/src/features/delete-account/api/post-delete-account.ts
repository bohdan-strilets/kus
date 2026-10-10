import type { DeleteAccountRequest } from '@kus/shared'

import { httpClient } from '@/shared/api'

/** 204: the API clears the cookies and ends every session of the account. */
export const postDeleteAccount = async (body: DeleteAccountRequest): Promise<void> => {
	await httpClient.post<unknown>('/account/delete', body)
}
