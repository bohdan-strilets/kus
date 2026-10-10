import type { ApiMessage } from '@/shared/api'

export type ChangePasswordField = 'currentPassword' | 'newPassword' | 'repeatPassword'

export interface ChangePasswordError {
	fields: Partial<Record<ChangePasswordField, ApiMessage>>
	/** The alert line above the button: everything that is not about one field. */
	form?: ApiMessage
}
