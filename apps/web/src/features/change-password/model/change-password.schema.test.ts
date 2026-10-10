import { PASSWORD_MIN_LENGTH } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { createChangePasswordSchema } from './change-password.schema'

const schema = createChangePasswordSchema(i18n.t.bind(i18n))
const longPassword = 'a'.repeat(PASSWORD_MIN_LENGTH)
const valid = { currentPassword: 'old', newPassword: longPassword, repeatPassword: longPassword }

const getMessages = (values: unknown): Record<string, string> => {
	const result = schema.safeParse(values)
	if (result.success) return {}
	return Object.fromEntries(
		result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
	)
}

describe('createChangePasswordSchema', () => {
	it('accepts a matching long password', () => {
		expect(schema.safeParse(valid).success).toBe(true)
	})

	it('asks for the current password and a long enough new one', () => {
		expect(
			getMessages({ currentPassword: '', newPassword: 'short', repeatPassword: 'short' }),
		).toEqual({
			currentPassword: 'Введи пароль',
			newPassword: `Мінімум ${PASSWORD_MIN_LENGTH} символів`,
		})
	})

	it('puts the mismatch under the repeat field', () => {
		expect(getMessages({ ...valid, repeatPassword: `${longPassword}x` })).toEqual({
			repeatPassword: 'Паролі не збігаються',
		})
	})
})
