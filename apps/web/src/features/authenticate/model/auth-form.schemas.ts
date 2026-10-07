import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

/** The same limits as the API (packages/shared), with messages a person can act on. */
const createEmailSchema = (t: TFunction) =>
	z
		.string()
		.trim()
		.min(1, t('auth.validation.emailRequired'))
		.pipe(z.email(t('auth.validation.emailInvalid')))

export const createLoginSchema = (t: TFunction) =>
	z.object({
		email: createEmailSchema(t),
		// no min length on login: the policy belongs to registration (shared loginRequestSchema)
		password: z
			.string()
			.min(1, t('auth.validation.passwordRequired'))
			.max(PASSWORD_MAX_LENGTH, t('auth.validation.passwordTooLong', { max: PASSWORD_MAX_LENGTH })),
	})

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>

export const createRegisterSchema = (t: TFunction) =>
	z.object({
		name: z
			.string()
			.trim()
			.min(1, t('auth.validation.nameRequired'))
			.max(USER_NAME_MAX_LENGTH, t('auth.validation.nameTooLong', { max: USER_NAME_MAX_LENGTH })),
		email: createEmailSchema(t),
		password: z
			.string()
			.min(PASSWORD_MIN_LENGTH, t('auth.validation.passwordTooShort', { min: PASSWORD_MIN_LENGTH }))
			.max(PASSWORD_MAX_LENGTH, t('auth.validation.passwordTooLong', { max: PASSWORD_MAX_LENGTH })),
		consent: z.boolean().refine(Boolean, t('auth.validation.consentRequired')),
	})

export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>
