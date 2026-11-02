// @vitest-environment jsdom
import type { ProgramResponse, ProgramTemplateResponse } from '@kus/shared'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useComposerDraftStore } from '@/features/send-message'
import { httpClient } from '@/shared/api'
import { ROUTES, TAB_ROUTES } from '@/shared/config'
import { renderWithProviders } from '@/shared/testing'

import { TrainingProgramPage } from './TrainingProgramPage'

const getMock = vi.spyOn(httpClient, 'get')
const patchMock = vi.spyOn(httpClient, 'patch')
const deleteMock = vi.spyOn(httpClient, 'delete')

const ID_A = '0199b3a4-0000-7000-8000-00000000000a'
const ID_B = '0199b3a4-0000-7000-8000-00000000000b'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000c1'
const EMPTY_TARGET = {
	sets: 3,
	repsMin: 8,
	repsMax: 12,
	weightKg: 60,
	progressStepKg: 2.5,
	restSec: 90,
	durationMin: null,
	distanceM: null,
}

const makeTemplate = (id: string, name: string, weekdays: number[]): ProgramTemplateResponse => ({
	id,
	key: id,
	name,
	position: 0,
	weekdays,
	estimatedMin: 55,
	muscleGroups: ['CHEST'],
	hasCardio: false,
	exercises: [
		{
			id,
			exerciseId: null,
			name: 'Жим',
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			position: 0,
			target: EMPTY_TARGET,
			lastSets: null,
			lastPerformedAt: null,
			isBodyweight: null,
			progressHintKg: null,
		},
	],
})

const makeProgram = (patch: Partial<ProgramResponse> = {}): ProgramResponse => ({
	id: VERSION_ID,
	title: 'Все тіло',
	mode: 'ROTATE',
	perWeek: 3,
	pinnedTemplateId: null,
	version: { id: VERSION_ID, createdAt: '2026-10-31T19:15:00.000Z' },
	templates: [makeTemplate(ID_A, 'Тренування А', [1]), makeTemplate(ID_B, 'Тренування Б', [])],
	next: { templateId: ID_B, weekday: null, date: null, isToday: false },
	...patch,
})

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const mockProgram = (program: ProgramResponse | null) => {
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/programs/active' ? program : [])),
	)
}

const renderPage = (onPathname?: (pathname: string) => void) =>
	renderWithProviders(<TrainingProgramPage />, { route: '/app/training/program', onPathname })

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingProgramPage', () => {
	it('shows the program: the subtitle, the days and the next one', async () => {
		mockProgram(makeProgram())
		renderPage()

		expect(await screen.findByText('Все тіло · 2 тренування · 3 рази на тиждень')).toBeTruthy()
		expect(screen.getByText('Тренування А')).toBeTruthy()
		expect(screen.getAllByText('наступне')).toHaveLength(1)
		expect(
			screen.getByText('А → Б → А… Наступне — те, що йде після останнього зробленого.'),
		).toBeTruthy()
	})

	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()

		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('shows an error with a retry when the program does not load', async () => {
		getMock.mockRejectedValue(new Error('offline'))
		renderPage()

		expect(await screen.findByText('Не вдалося завантажити програму.')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy()
	})

	it('leaves for the training tab when there is no program', async () => {
		mockProgram(null)
		const onPathname = vi.fn()
		renderPage(onPathname)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(TAB_ROUTES.training)
		})
	})

	it('changes the mode', async () => {
		mockProgram(makeProgram())
		patchMock.mockResolvedValue(reply(makeProgram({ mode: 'WEEKDAYS' })))
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'За днями тижня' }))

		await waitFor(() => {
			expect(patchMock).toHaveBeenCalledWith('/programs/active', { mode: 'WEEKDAYS' })
		})
		expect(
			await screen.findByText('Наступне — за сьогоднішнім днем; у день без шаблону — найближче.'),
		).toBeTruthy()
	})

	it('pins a template in «Завжди одне»', async () => {
		mockProgram(makeProgram({ mode: 'SINGLE', pinnedTemplateId: ID_A }))
		patchMock.mockResolvedValue(reply(makeProgram({ mode: 'SINGLE', pinnedTemplateId: ID_B })))
		renderPage()

		expect(
			(await screen.findByRole('button', { name: 'Обрати: Тренування А' })).getAttribute(
				'aria-pressed',
			),
		).toBe('true')
		fireEvent.click(screen.getByRole('button', { name: 'Обрати: Тренування Б' }))

		await waitFor(() => {
			expect(patchMock).toHaveBeenCalledWith('/programs/active', { pinnedTemplateId: ID_B })
		})
	})

	it('toggles a weekday of a template in «За днями тижня»', async () => {
		mockProgram(makeProgram({ mode: 'WEEKDAYS' }))
		patchMock.mockResolvedValue(reply(makeProgram({ mode: 'WEEKDAYS' })))
		renderPage()

		const group = await screen.findByRole('group', { name: 'Дні тижня: Тренування А' })
		expect(
			within(group).getByRole('button', { name: 'Понеділок' }).getAttribute('aria-pressed'),
		).toBe('true')
		fireEvent.click(within(group).getByRole('button', { name: 'Четвер' }))

		await waitFor(() => {
			expect(patchMock).toHaveBeenCalledWith(`/programs/active/templates/${ID_A}`, {
				weekdays: [1, 4],
			})
		})
	})

	it('keeps the weekday buttons 44px with a 36px circle, and the mode segments 44px', async () => {
		mockProgram(makeProgram({ mode: 'WEEKDAYS' }))
		renderPage()

		const group = await screen.findByRole('group', { name: 'Дні тижня: Тренування А' })
		const day = within(group).getByRole('button', { name: 'Понеділок' })
		expect(day.className).toContain('size-11')
		expect(day.firstElementChild?.className).toContain('size-9')
		const segment = screen.getByRole('button', { name: 'За днями тижня' })
		expect(segment.className).toContain('min-h-tap')
		expect(segment.className).toContain('whitespace-nowrap')
	})

	it('keeps the weekday buttons 44px around a 36px circle and the mode segments 44px', async () => {
		mockProgram(makeProgram({ mode: 'WEEKDAYS' }))
		renderPage()

		const group = await screen.findByRole('group', { name: 'Дні тижня: Тренування А' })
		const day = within(group).getByRole('button', { name: 'Понеділок' })
		expect(day.className).toContain('size-11')
		expect(day.firstElementChild?.className).toContain('size-9')
		const segment = screen.getByRole('button', { name: 'За днями тижня' })
		expect(segment.className).toContain('min-h-tap')
		expect(segment.className).toContain('whitespace-nowrap')
	})

	it('opens the chat with the composer in focus', async () => {
		mockProgram(makeProgram())
		const onPathname = vi.fn()
		renderPage(onPathname)

		fireEvent.click(await screen.findByRole('button', { name: 'Змінити в чаті' }))

		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.chat)
		expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
	})

	it('removes the program after the confirmation', async () => {
		mockProgram(makeProgram())
		deleteMock.mockResolvedValue({ status: 204 })
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Прибрати програму' }))
		expect(
			await screen.findByText('Шаблони зникнуть з вкладки. Журнал тренувань лишиться.'),
		).toBeTruthy()
		expect(deleteMock).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати' }))

		await waitFor(() => {
			expect(deleteMock).toHaveBeenCalledWith('/programs/active')
		})
	})
})
