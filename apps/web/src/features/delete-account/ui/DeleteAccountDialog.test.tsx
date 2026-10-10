// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { httpClient } from '@/shared/api'
import { apiErrorBody, createFakeAdapter, renderWithProviders } from '@/shared/testing'

import { DeleteAccountDialog } from './DeleteAccountDialog'

const originalAdapter = httpClient.defaults.adapter
const CONFIRM_LABEL = 'Видалити акаунт'

const renderOpenDialog = () =>
	renderWithProviders(<DeleteAccountDialog isOpen onOpenChange={() => undefined} />)

afterEach(() => {
	cleanup()
	httpClient.defaults.adapter = originalAdapter
})

describe('DeleteAccountDialog', () => {
	it('keeps the delete button disabled until a password is typed', async () => {
		const user = userEvent.setup()
		renderOpenDialog()
		const confirm = await screen.findByRole('button', { name: CONFIRM_LABEL })

		expect((confirm as HTMLButtonElement).disabled).toBe(true)

		await user.type(screen.getByLabelText('Пароль'), 'secret-password')

		expect((confirm as HTMLButtonElement).disabled).toBe(false)
	})

	it('shows a wrong password under the field and stays open', async () => {
		const fake = createFakeAdapter(() => ({
			status: 400,
			data: apiErrorBody(400, 'PASSWORD_INCORRECT'),
		}))
		httpClient.defaults.adapter = fake.adapter
		const user = userEvent.setup()
		renderOpenDialog()

		await user.type(await screen.findByLabelText('Пароль'), 'wrong-password')
		await user.click(screen.getByRole('button', { name: CONFIRM_LABEL }))

		expect(await screen.findByText('Неправильний пароль.')).toBeTruthy()
		expect(fake.countCalls('/account/delete')).toBe(1)
		expect(screen.getByRole('alertdialog')).toBeTruthy()
	})
})
