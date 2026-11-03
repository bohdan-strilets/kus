// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { ROUTES, TRAINING_FILL_ROUTE, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { makeLiveResponse, makeTemplate, renderWithProviders, TEMPLATE_ID } from '@/shared/testing'

import { EmptyWorkoutCard } from './EmptyWorkoutCard'
import { NextWorkoutCard } from './NextWorkoutCard'
import { NoProgramStart } from './NoProgramStart'
import { OpenWorkoutCard } from './OpenWorkoutCard'

const getMock = vi.spyOn(httpClient, 'get')
const postMock = vi.spyOn(httpClient, 'post')

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

/** Shows where the app navigated, with the query string. */
const LocationProbe = () => {
	const { pathname, search } = useLocation()
	return <output data-testid="location">{`${pathname}${search}`}</output>
}

const renderWithProbe = (ui: React.ReactElement) =>
	renderWithProviders(
		<>
			{ui}
			<LocationProbe />
		</>,
	)

const locationText = (): string | null => screen.getByTestId('location').textContent

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-11-02T09:23:14.000Z'))
	postMock.mockResolvedValue(reply(makeLiveResponse({ templateName: 'Верх А' })))
})

afterEach(() => {
	vi.useRealTimers()
	cleanup()
	vi.clearAllMocks()
})

describe('NextWorkoutCard', () => {
	it('[Почати] starts a session of the template, then opens the live screen', async () => {
		renderWithProbe(<NextWorkoutCard template={makeTemplate()} />)

		fireEvent.click(screen.getByRole('button', { name: 'Почати' }))

		await waitFor(() => {
			expect(locationText()).toBe(TRAINING_LIVE_ROUTE)
		})
		expect(postMock).toHaveBeenCalledTimes(1)
		expect(postMock).toHaveBeenCalledWith('/live-workouts', { templateId: TEMPLATE_ID })
	})

	it('[Почати] stays on the tab and shows a toast when the start fails', async () => {
		postMock.mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		renderWithProbe(<NextWorkoutCard template={makeTemplate()} />)

		fireEvent.click(screen.getByRole('button', { name: 'Почати' }))

		expect(await screen.findByText(/Немає зв/)).toBeTruthy()
		expect(locationText()).toBe('/')
	})

	it('[Заповнити] opens the form of the template without starting a session', () => {
		renderWithProbe(<NextWorkoutCard template={makeTemplate()} />)

		fireEvent.click(screen.getByRole('button', { name: 'Заповнити' }))

		expect(locationText()).toBe(`${TRAINING_FILL_ROUTE}?templateId=${TEMPLATE_ID}`)
		expect(postMock).not.toHaveBeenCalled()
	})

	it('shows the template and its exercises', () => {
		renderWithProbe(<NextWorkoutCard template={makeTemplate()} />)

		expect(screen.getByText('Наступне')).toBeTruthy()
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByRole('link').textContent).toContain('Верх А')
	})
})

describe('OpenWorkoutCard', () => {
	it('says «Іде · mm:ss» and [Продовжити] returns to the live screen', () => {
		renderWithProbe(<OpenWorkoutCard live={makeLiveResponse({ templateName: 'Верх А' })} />)

		expect(screen.getByText('Верх А')).toBeTruthy()
		expect(screen.getByText('Іде · 23:14')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: 'Продовжити' }))

		expect(locationText()).toBe(TRAINING_LIVE_ROUTE)
		expect(postMock).not.toHaveBeenCalled()
	})

	it('names a session without a template «Тренування»', () => {
		renderWithProbe(<OpenWorkoutCard live={makeLiveResponse()} />)

		expect(screen.getByText('Тренування')).toBeTruthy()
	})
})

describe('EmptyWorkoutCard', () => {
	it('starts an empty session with templateId null', async () => {
		renderWithProbe(<EmptyWorkoutCard />)

		fireEvent.click(screen.getByRole('button', { name: 'Почати' }))

		await waitFor(() => {
			expect(locationText()).toBe(TRAINING_LIVE_ROUTE)
		})
		expect(postMock).toHaveBeenCalledWith('/live-workouts', { templateId: null })
	})

	it('[Заповнити] opens the form without a template', () => {
		renderWithProbe(<EmptyWorkoutCard />)

		fireEvent.click(screen.getByRole('button', { name: 'Заповнити' }))

		expect(locationText()).toBe(TRAINING_FILL_ROUTE)
	})

	it('offers «Скласти програму в чаті» as a link to the chat', () => {
		renderWithProbe(<EmptyWorkoutCard />)

		expect(screen.getByRole('link', { name: 'Скласти програму в чаті' }).getAttribute('href')).toBe(
			ROUTES.chat,
		)
		expect(screen.getByText('Порожнє тренування')).toBeTruthy()
	})
})

describe('NoProgramStart', () => {
	it('shows the empty card when no session is open', async () => {
		getMock.mockResolvedValue(reply(null))
		renderWithProbe(<NoProgramStart />)

		expect(await screen.findByText('Порожнє тренування')).toBeTruthy()
		expect(screen.queryByText(/^Іде/)).toBeNull()
	})

	it('shows the open session instead of the empty card', async () => {
		getMock.mockResolvedValue(reply(makeLiveResponse({ templateName: 'Верх А' })))
		renderWithProbe(<NoProgramStart />)

		expect(await screen.findByText('Іде · 23:14')).toBeTruthy()
		expect(screen.queryByText('Порожнє тренування')).toBeNull()
	})
})
