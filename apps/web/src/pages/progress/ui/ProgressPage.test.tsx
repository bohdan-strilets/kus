// @vitest-environment jsdom
import type { ProgressResponse } from '@kus/shared'
import type { AxiosResponse } from 'axios'
import { AxiosHeaders } from 'axios'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useComposerDraftStore } from '@/features/send-message'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { makeProgress, renderWithProviders } from '@/shared/testing'

import { ProgressPage } from './ProgressPage'

const getMock = vi.spyOn(httpClient, 'get')

const reply = (progress: ProgressResponse): AxiosResponse => ({
	data: { data: progress },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const renderPage = (onPathname?: (pathname: string) => void) =>
	renderWithProviders(<ProgressPage />, { route: ROUTES.progress, onPathname })

const showsProgress = (progress: ProgressResponse): void => {
	getMock.mockResolvedValue(reply(progress))
}

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('ProgressPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))

		renderPage()

		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('shows the weight card, the week and the insight, the mockup month by default', async () => {
		showsProgress(makeProgress())

		renderPage()

		expect(await screen.findAllByText('82,4')).not.toHaveLength(0)
		expect(screen.getByText('−1,6 кг')).toBeTruthy()
		expect(screen.getByText('ціль 78 кг · до цілі 4,4 кг')).toBeTruthy()
		expect(screen.getByText('Середнє')).toBeTruthy()
		expect(screen.getByText('2 195 ккал')).toBeTruthy()
		expect(screen.getByText('Білок, середнє')).toBeTruthy()
		expect(screen.getByText('124 г')).toBeTruthy()
		expect(screen.getByText(/Мінус 0,4 кг за тиждень/)).toBeTruthy()
		expect(screen.getByText('Обговорити в чаті')).toBeTruthy()
		expect(getMock).toHaveBeenCalledWith('/progress', { params: { range: 30 } })
		expect(screen.getByRole('button', { name: '30 днів' }).getAttribute('aria-pressed')).toBe(
			'true',
		)
	})

	it('asks for the chosen range, and the week card does not change with it', async () => {
		showsProgress(makeProgress())
		renderPage()
		await screen.findByText('2 195 ккал')

		showsProgress(makeProgress({ range: 7 }))
		fireEvent.click(screen.getByRole('button', { name: '7 днів' }))

		await waitFor(() => {
			expect(getMock).toHaveBeenLastCalledWith('/progress', { params: { range: 7 } })
		})
		expect(screen.getByRole('button', { name: '7 днів' }).getAttribute('aria-pressed')).toBe('true')
		expect(await screen.findByText('2 195 ккал')).toBeTruthy()
	})

	it('says there are no weigh-ins in the period instead of drawing an empty chart', async () => {
		const base = makeProgress()
		showsProgress(
			makeProgress({
				weight: base.weight && { ...base.weight, points: [], changeInRange: null },
			}),
		)

		renderPage()

		expect(await screen.findAllByText('82,4')).not.toHaveLength(0)
		expect(screen.getByText('За цей період зважувань немає')).toBeTruthy()
		expect(screen.queryByRole('img', { name: /Вага/ })).toBeNull()
		expect(screen.queryByText('−1,6 кг')).toBeNull()
	})

	it('says «Ціль досягнута» instead of «до цілі 0»', async () => {
		const base = makeProgress()
		showsProgress(
			makeProgress({
				weight: base.weight && { ...base.weight, toGoal: 0, isGoalReached: true },
			}),
		)

		renderPage()

		expect(await screen.findByText('Ціль досягнута')).toBeTruthy()
		expect(screen.queryByText(/до цілі/)).toBeNull()
	})

	it('replaces the weight card with an invitation when weight was never recorded', async () => {
		showsProgress(makeProgress({ weight: null }))
		const paths: string[] = []

		renderPage((pathname) => paths.push(pathname))
		fireEvent.click(await screen.findByRole('button', { name: 'Записати вагу' }))

		expect(screen.getByText('2 195 ккал')).toBeTruthy()
		expect(useComposerDraftStore.getState().text).toBe('вага ')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.chat)
		})
	})

	it('shows the waist only when there is one', async () => {
		showsProgress(makeProgress())
		const { unmount } = renderPage()
		await screen.findAllByText('82,4')
		expect(screen.queryByText('Талія')).toBeNull()
		unmount()

		showsProgress(
			makeProgress({
				waist: {
					current: { value: 94, localDate: '2026-10-12' },
					changeInRange: -3,
					points: [
						{ localDate: '2026-09-20', value: 97 },
						{ localDate: '2026-10-12', value: 94 },
					],
				},
			}),
		)
		renderPage()

		expect(await screen.findByText('Талія')).toBeTruthy()
		expect(screen.getByText('94')).toBeTruthy()
		expect(screen.getByText('−3 см')).toBeTruthy()
	})

	it('says there are no measurements in the period for a waist without points', async () => {
		showsProgress(
			makeProgress({
				waist: { current: { value: 94, localDate: '2026-08-01' }, changeInRange: null, points: [] },
			}),
		)

		renderPage()

		expect(await screen.findByText(/^За цей період замірів немає./)).toBeTruthy()
		expect(screen.getByText('94')).toBeTruthy()
	})

	it('hides the insight card when there is nothing to say', async () => {
		showsProgress(
			makeProgress({
				insight: {
					weekPaceKg: null,
					planPaceKgPerWeek: null,
					goalType: null,
					overDays: 0,
					isWeekendProteinLow: false,
				},
			}),
		)

		renderPage()
		await screen.findAllByText('82,4')

		expect(screen.queryByText('Обговорити в чаті')).toBeNull()
	})

	it('shows the empty state with a way to record the weight', async () => {
		showsProgress(makeProgress({ isEmpty: true, weight: null, waist: null }))
		const paths: string[] = []

		renderPage((pathname) => paths.push(pathname))
		expect(await screen.findByText("Графік з'явиться за кілька днів")).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Записати вагу' }))

		expect(useComposerDraftStore.getState().text).toBe('вага ')
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
		await waitFor(() => {
			expect(paths.at(-1)).toBe(ROUTES.chat)
		})
	})

	it('keeps a draft the user already has when going to the chat', async () => {
		useComposerDraftStore.setState({ text: 'гречка 150 г' })
		showsProgress(makeProgress({ isEmpty: true, weight: null, waist: null }))

		renderPage()
		fireEvent.click(await screen.findByRole('button', { name: 'Записати вагу' }))

		expect(useComposerDraftStore.getState().text).toBe('гречка 150 г')
	})

	it('shows an inline error and tries again', async () => {
		getMock.mockRejectedValueOnce(new Error('boom'))
		renderPage()
		expect(await screen.findByText('Не вдалося завантажити прогрес.')).toBeTruthy()

		showsProgress(makeProgress())
		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))

		expect(await screen.findAllByText('82,4')).not.toHaveLength(0)
	})
})
