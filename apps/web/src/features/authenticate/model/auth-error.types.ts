export type AuthFormField = 'name' | 'email' | 'password' | 'consent'

export type ValidationMessageKey =
	| 'errors.validation.REQUIRED'
	| 'errors.validation.INVALID_FORMAT'
	| 'errors.validation.TOO_SMALL'
	| 'errors.validation.TOO_LARGE'
	| 'errors.validation.INVALID_VALUE'

export type AuthErrorMessage =
	| {
			key:
				| 'errors.api.INVALID_CREDENTIALS'
				| 'errors.api.ACCOUNT_LOCKED_NO_TIME'
				| 'errors.api.TOO_MANY_REQUESTS'
				| 'errors.api.REGISTRATION_DISABLED'
				| 'errors.api.EMAIL_TAKEN'
				| 'errors.api.NETWORK'
				| 'errors.api.SERVER'
				| 'errors.api.UNKNOWN'
				| ValidationMessageKey
	  }
	| { key: 'errors.api.ACCOUNT_LOCKED'; params: { time: string } }

export interface AuthFormError {
	/** Shown under the field: the card turns red and shakes. */
	fields: Partial<Record<AuthFormField, AuthErrorMessage>>
	/** The alert line above the submit button; the fields stay neutral. */
	form?: AuthErrorMessage
}
