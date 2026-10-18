// @vitest-environment jsdom
import type { AuthUser, DayResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import { AxiosHeaders } from 'axios'
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatDayHeading, toCalendarDate } from '@/shared/lib'
import { renderWithProviders } from '@/shared/testing'

import { TodayPage } from './TodayPage'

const YESTERDAY = '2026-10-12'
const TODAY_AFTER_MIDNIGHT = '2026-10-13'
/** 23:59:30 in Warsaw (UTC+2) on 12 October. */
const BEFORE_MIDNIGHT = '2026-10-12T21:59:30.000Z'
/** 00:10 in Warsaw on 13 October. */
const AFTER_MIDNIGHT = '2026-10-12T22:10:00.000Z'
const HALF_MINUTE_MS = 30_000

const getMock = vi.spyOn(httpClient, 'get')

const user: AuthUser = {
	id: '0199b3a4-0000-7000-8000-00000000000a',
	email: 'user@example.com',
	name: null,
	addressAs: null,
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T10:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const emptyDay = (localDate: string): DayResponse => ({
	localDate,
	meals: [],
	totals: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
	goal: null,
	remainingKcal: null,
})

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const answerByUrl = (url: string): Promise<AxiosResponse> => {
	if (url.startsWith('/days/')) return Promise.resolve(reply(emptyDay(url.slice('/days/'.length))))
	return Promise.resolve(reply([]))
}

const dayRequests = (): string[] =>
	getMock.mock.calls.map(([url]) => url).filter((url) => url.startsWith('/days/'))

// fake timers: waitFor/findBy would hang, so flush the promises and timers by hand
const settle = async (ms = 0): Promise<void> => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})
}

const renderPage = (route: string = ROUTES.today) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	return renderWithProviders(<TodayPage />, { route, queryClient })
}

const dateLine = (localDate: string): string => formatDayHeading(toCalendarDate(localDate))

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date(BEFORE_MIDNIGHT))
	getMock.mockImplementation(answerByUrl)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.useRealTimers()
})

describe('TodayPage across local midnight', () => {
	it('asks for the day it is before midnight', async () => {
		renderPage()
		await settle()

		expect(dayRequests()).toEqual([`/days/${YESTERDAY}`])
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Сьогодні')
		expect(screen.getByText(dateLine(YESTERDAY))).toBeTruthy()
	})

	it('asks for the new day after midnight and shows its date under the same title', async () => {
		renderPage()
		await settle()
		expect(dateLine(TODAY_AFTER_MIDNIGHT)).not.toBe(dateLine(YESTERDAY))

		await settle(HALF_MINUTE_MS)

		expect(dayRequests()).toContain(`/days/${TODAY_AFTER_MIDNIGHT}`)
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Сьогодні')
		expect(screen.getByText(dateLine(TODAY_AFTER_MIDNIGHT))).toBeTruthy()
		expect(screen.queryByText(dateLine(YESTERDAY))).toBeNull()
		// the week strip follows too: its window now ends on the new today
		const rangeEnds = getMock.mock.calls
			.filter(([url]) => url === '/days')
			.map(([, config]) => (config?.params as { to: string }).to)
		expect(rangeEnds).toContain(TODAY_AFTER_MIDNIGHT)
	})

	it('keeps the explicitly chosen day after midnight: it becomes «Вчора»', async () => {
		renderPage(`${ROUTES.today}?date=${YESTERDAY}`)
		await settle()
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Сьогодні')

		await settle(HALF_MINUTE_MS)

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Вчора')
		expect(screen.getByText(dateLine(YESTERDAY))).toBeTruthy()
	})

	it('follows the new day on focus after the clock jumped over midnight', async () => {
		renderPage()
		await settle()

		vi.setSystemTime(new Date(AFTER_MIDNIGHT))
		act(() => {
			window.dispatchEvent(new Event('focus'))
		})
		await settle()

		expect(dayRequests()).toContain(`/days/${TODAY_AFTER_MIDNIGHT}`)
		expect(screen.getByText(dateLine(TODAY_AFTER_MIDNIGHT))).toBeTruthy()
	})
})
