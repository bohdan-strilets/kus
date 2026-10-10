import type { ChangePasswordRequest } from '@kus/shared'

import { httpClient } from '@/shared/api'

/** 204: the API ends the other sessions; this device keeps its fresh cookies. */
export const postChangePassword = async (body: ChangePasswordRequest): Promise<void> => {
	await httpClient.post<unknown>('/auth/change-password', body)
}
