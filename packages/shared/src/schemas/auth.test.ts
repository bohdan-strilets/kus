import { describe, expect, it } from 'vitest'

import { loginRequestSchema, PASSWORD_MAX_LENGTH, registerRequestSchema } from './auth.js'

const validRegister = {
	email: 'me@kus.app',
	password: 'correct-horse',
	name: 'Богдан',
	consent: true,
}

describe('registerRequestSchema', () => {
	it('normalizes email to trimmed lowercase', () => {
		const result = registerRequestSchema.parse({ ...validRegister, email: '  Me@Kus.APP ' })

		expect(result.email).toBe('me@kus.app')
	})

	it('rejects a password shorter than 10 characters', () => {
		expect(
			registerRequestSchema.safeParse({ ...validRegister, password: '123456789' }).success,
		).toBe(false)
	})

	it('rejects a password longer than the max length', () => {
		const password = 'a'.repeat(PASSWORD_MAX_LENGTH + 1)

		expect(registerRequestSchema.safeParse({ ...validRegister, password }).success).toBe(false)
	})

	it('rejects a blank name', () => {
		expect(registerRequestSchema.safeParse({ ...validRegister, name: '   ' }).success).toBe(false)
	})

	it('requires consent to data processing', () => {
		const { consent: _consent, ...withoutConsent } = validRegister

		expect(registerRequestSchema.safeParse(withoutConsent).success).toBe(false)
		expect(registerRequestSchema.safeParse({ ...validRegister, consent: false }).success).toBe(
			false,
		)
	})

	it('rejects an invalid email', () => {
		expect(
			registerRequestSchema.safeParse({ ...validRegister, email: 'not-an-email' }).success,
		).toBe(false)
	})
})

describe('loginRequestSchema', () => {
	it('accepts a short password so the policy does not leak on login', () => {
		expect(loginRequestSchema.safeParse({ email: 'me@kus.app', password: 'x' }).success).toBe(true)
	})
})
