// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { makeTemplate, makeWorkout, renderWithProviders } from '@/shared/testing'

import { FillScreen } from './FillScreen'

const postMock = vi.spyOn(httpClient, 'post')

const NOW = { localDate: '2026-11-02', time: '18:30' }
const MESSAGE_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const setDuration = (value: string): void => {
	fireEvent.change(screen.getByRole('textbox', { name: /Тривалість/ }), { target: { value } })
}

const lastBody = (): { startTime: string; localDate: string; durationMin: number } =>
	postMock.mock.calls.at(-1)?.[1] as never

const applyWhen = async (day: string, time: string): Promise<void> => {
	fireEvent.click(screen.getByRole('button', { name: /^Коли/ }))
	const dialog = await screen.findByRole('dialog')
	fireEvent.click(within(dialog).getByRole('button', { name: day }))
	fireEvent.change(within(dialog).getByLabelText('Початок'), { target: { value: time } })
	fireEvent.click(within(dialog).getByRole('button', { name: 'Готово' }))
	await waitFor(() => {
		expect(screen.queryByRole('dialog')).toBeNull()
	})
}

beforeEach(() => {
	postMock.mockResolvedValue(
		reply({ workout: makeWorkout(), messageId: MESSAGE_ID, hasNewRecord: false }),
	)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('FillScreen: the proposed start follows the duration', () => {
	it('starts at now minus the template estimate', () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)

		expect(screen.getByText('Сьогодні · 17:35')).toBeTruthy()
	})

	it('changing the duration recomputes the start while it was not edited by hand', () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)

		setDuration('90')
		expect(screen.getByText('Сьогодні · 17:00')).toBeTruthy()

		setDuration('')
		expect(screen.getByText('Сьогодні · 18:30')).toBeTruthy()
	})

	it('a duration that crosses midnight clamps the start to 00:00', () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={{ ...NOW, time: '00:20' }} />)

		setDuration('60')

		expect(screen.getByText('Сьогодні · 00:00')).toBeTruthy()
	})

	it('after «Готово» in «Коли» the start is frozen', async () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)
		await applyWhen('Сьогодні', '12:00')
		expect(screen.getByText('Сьогодні · 12:00')).toBeTruthy()

		setDuration('90')

		expect(screen.getByText('Сьогодні · 12:00')).toBeTruthy()
	})

	it('a backdated day keeps the chosen time', async () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)
		await applyWhen('Вчора', '20:00')
		expect(screen.getByText('Вчора · 20:00')).toBeTruthy()

		setDuration('30')

		expect(screen.getByText('Вчора · 20:00')).toBeTruthy()
	})
})

describe('FillScreen: a default form never ends in the future', () => {
	it.each([['55'], ['120'], ['1'], ['30']])(
		'duration %s: saves without a start-in-future error and start + duration <= now',
		async (minutes) => {
			renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)
			setDuration(minutes)

			fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

			await waitFor(() => {
				expect(postMock).toHaveBeenCalledTimes(1)
			})
			expect(screen.queryByText('Початок у майбутньому — вкажи раніше.')).toBeNull()
			const [hours = 0, mins = 0] = lastBody().startTime.split(':').map(Number)
			expect(hours * 60 + mins + Number(minutes)).toBeLessThanOrEqual(18 * 60 + 30)
		},
	)

	it('a hand-set start in the future is rejected beyond the 5-minute tolerance', async () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)
		await applyWhen('Сьогодні', '18:36')

		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		expect(await screen.findByText('Початок у майбутньому — вкажи раніше.')).toBeTruthy()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('a hand-set start within the tolerance is accepted', async () => {
		renderWithProviders(<FillScreen template={makeTemplate()} now={NOW} />)
		await applyWhen('Сьогодні', '18:35')

		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		expect(lastBody().startTime).toBe('18:35')
	})
})
