// @vitest-environment jsdom
import { PASSWORD_MIN_LENGTH } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderWithProviders } from '@/shared/testing'

import { ChangePasswordForm } from './ChangePasswordForm'

const originalAdapter = httpClient.defaults.adapter
const GOOD_PASSWORD = 'g'.repeat(PASSWORD_MIN_LENGTH)

const getField = (label: string): HTMLElement => screen.getByLabelText(label)

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
})

describe('ChangePasswordForm', () => {
	it('shows what is wrong under the new and the repeat fields after submit', async () => {
		const user = userEvent.setup()
		renderWithProviders(<ChangePasswordForm />)

		await user.type(getField('Поточний пароль'), 'old-password')
		await user.type(getField('Новий пароль'), 'short')
		await user.type(getField('Повтори новий пароль'), 'other')
		await user.click(screen.getByRole('button', { name: 'Зберегти пароль' }))

		const alerts = await screen.findAllByRole('alert')
		const texts = alerts.map((alert) => alert.textContent)
		expect(texts).toContain(`Мінімум ${PASSWORD_MIN_LENGTH} символів`)
		expect(texts).toContain('Паролі не збігаються')
	})

	it('keeps the form and names the current password when the API says it is wrong', async () => {
		const fake = createFakeAdapter(() => ({
			status: 400,
			data: apiErrorBody(400, 'PASSWORD_INCORRECT'),
		}))
		httpClient.defaults.adapter = fake.adapter
		const user = userEvent.setup()
		renderWithProviders(<ChangePasswordForm />)

		await user.type(getField('Поточний пароль'), 'wrong-password')
		await user.type(getField('Новий пароль'), GOOD_PASSWORD)
		await user.type(getField('Повтори новий пароль'), GOOD_PASSWORD)
		await user.click(screen.getByRole('button', { name: 'Зберегти пароль' }))

		expect(await screen.findByText('Неправильний пароль.')).toBeTruthy()
		expect(fake.countCalls('/auth/change-password')).toBe(1)
		expect(screen.getByRole('button', { name: 'Зберегти пароль' })).toBeTruthy()
	})
})
