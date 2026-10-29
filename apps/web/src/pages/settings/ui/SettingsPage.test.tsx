// @vitest-environment jsdom
import type { AuthUser } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { setSessionUser } from '@/entities/session'
import { renderWithProviders } from '@/shared/testing'

import { SettingsPage } from './SettingsPage'

afterEach(cleanup)

const user: AuthUser = {
	id: '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
	email: 'me@kus.app',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T08:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

describe('SettingsPage', () => {
	it('shows the full package.json version, not major.minor', () => {
		const queryClient = new QueryClient()
		setSessionUser(queryClient, user)
		renderWithProviders(<SettingsPage />, { queryClient })

		expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/)
		expect(screen.getByText(`Kusik · версія ${__APP_VERSION__}`)).toBeTruthy()
	})

	it.each([
		['NEUTRAL', 'Нейтрально'],
		['MASCULINE', 'У чоловічому роді'],
		['FEMININE', 'У жіночому роді'],
	] as const)('shows %s as «%s» in the «Kusik» row', (addressForm, label) => {
		const queryClient = new QueryClient()
		setSessionUser(queryClient, { ...user, addressForm })
		renderWithProviders(<SettingsPage />, { queryClient })

		expect(screen.getByRole('button', { name: /Як до тебе звертатися/ }).textContent).toContain(
			label,
		)
	})

	it('opens the sheet with the three cards from the row', async () => {
		const queryClient = new QueryClient()
		setSessionUser(queryClient, user)
		renderWithProviders(<SettingsPage />, { queryClient })

		await userEvent.click(screen.getByRole('button', { name: /Як до тебе звертатися/ }))

		expect(await screen.findAllByRole('radio')).toHaveLength(3)
	})
})
