// @vitest-environment jsdom
import type { ProfileResponse } from '@kus/shared'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { renderWithProviders } from '@/shared/testing'

import { MyDataPage } from './MyDataPage'

const getMock = vi.spyOn(httpClient, 'get')

const profile: ProfileResponse = {
	email: 'user@example.com',
	name: null,
	addressAs: null,
	profile: {
		sex: 'MALE',
		age: 30,
		heightCm: 182,
		activityLevel: 'LIGHT',
		targetWeightKg: 78,
		goalType: 'LOSE',
		paceKgPerWeek: 0.25,
	},
	weight: { kg: 82.4, localDate: '2026-10-07' },
	waist: null,
	goals: null,
}

const reply = (data: ProfileResponse): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('MyDataPage measurements', () => {
	it('lists the waist row even when it was never measured', async () => {
		getMock.mockResolvedValue(reply(profile))

		renderWithProviders(<MyDataPage />)

		expect(await screen.findByText('Талія')).toBeTruthy()
	})

	it('opens the info sheet from the link and closes it with «Зрозуміло»', async () => {
		getMock.mockResolvedValue(reply(profile))
		renderWithProviders(<MyDataPage />)

		fireEvent.click(await screen.findByRole('button', { name: 'Навіщо й як міряти' }))
		expect(await screen.findByText('Як міряти талію')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: 'Зрозуміло' }))
		await waitFor(() => {
			expect(screen.queryByText('Як міряти талію')).toBeNull()
		})
	})

	it('shows the measure note once, under the body section only', async () => {
		getMock.mockResolvedValue(reply(profile))

		renderWithProviders(<MyDataPage />)

		expect(await screen.findAllByRole('button', { name: 'Навіщо й як міряти' })).toHaveLength(1)
	})
})
