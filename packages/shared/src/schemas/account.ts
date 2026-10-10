import { z } from 'zod'

import { PASSWORD_MAX_LENGTH } from './auth.js'

/** Days between the deletion request and the hard delete; «Передумаєш — просто увійди знову до …». */
export const ACCOUNT_DELETION_GRACE_DAYS = 30

/** Body of POST /account/delete: the current password confirms it (settings-delete-confirm). */
export const deleteAccountRequestSchema = z.object({
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>
