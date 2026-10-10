import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@kus/shared'
import type { TFunction } from 'i18next'
import { z } from 'zod'

export const createChangePasswordSchema = (t: TFunction) =>
	z
		.object({
			currentPassword: z.string().min(1, t('auth.validation.passwordRequired')),
			newPassword: z
				.string()
				.min(
					PASSWORD_MIN_LENGTH,
					t('auth.validation.passwordTooShort', { min: PASSWORD_MIN_LENGTH }),
				)
				.max(
					PASSWORD_MAX_LENGTH,
					t('auth.validation.passwordTooLong', { max: PASSWORD_MAX_LENGTH }),
				),
			repeatPassword: z.string(),
		})
		.refine((values) => values.repeatPassword === values.newPassword, {
			path: ['repeatPassword'],
			message: t('changePassword.validation.mismatch'),
		})

export type ChangePasswordFormValues = z.infer<ReturnType<typeof createChangePasswordSchema>>
