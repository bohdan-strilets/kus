// @vitest-environment jsdom
import type {
	AuthUser,
	ProgramResponse,
	ProgramTemplateResponse,
	WorkoutResponse,
} from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_QUERY_KEY } from '@/entities/session'
import { httpClient } from '@/shared/api'
import {
	ROUTES,
	TRAINING_PROGRAM_ROUTE,
	TRAINING_STATS_ROUTE,
	getTrainingTemplatePath,
} from '@/shared/config'
import { makeExercise, makeWorkout, makeWorkoutStats, renderWithProviders } from '@/shared/testing'

import { TrainingPage } from './TrainingPage'

const onboardingMock = vi.hoisted(() => ({ start: vi.fn(), dismiss: vi.fn() }))
vi.mock('@/features/training-onboarding/api/training-onboarding', () => ({
	startTrainingOnboarding: onboardingMock.start,
	dismissTrainingOnboarding: onboardingMock.dismiss,
}))

const getMock = vi.spyOn(httpClient, 'get')

const ANSWERED_AT = '2026-10-30T10:00:00.000Z'
const TEMPLATE_A = '0199b3a4-0000-7000-8000-0000000000a0'
const TEMPLATE_B = '0199b3a4-0000-7000-8000-0000000000b0'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000c1'

const makeTemplate = (id: string, name: string): ProgramTemplateResponse => ({
	id,
	key: id,
	name,
	position: 0,
	weekdays: [],
	estimatedMin: 55,
	muscleGroups: ['CHEST'],
	hasCardio: true,
	exercises: [
		{
			id: `${id.slice(0, -1)}1`,
			exerciseId: null,
			name: 'Жим гантелей',
			kind: 'STRENGTH',
			muscleGroup: 'CHEST',
			position: 0,
			target: {
				sets: 3,
				repsMin: 8,
				repsMax: 12,
				weightKg: 20,
				progressStepKg: null,
				restSec: null,
				durationMin: null,
				distanceM: null,
			},
			lastSets: null,
			lastPerformedAt: null,
			isBodyweight: null,
			progressHintKg: null,
		},
		{
			id: `${id.slice(0, -1)}2`,
			exerciseId: null,
			name: 'Доріжка',
			kind: 'CARDIO',
			muscleGroup: null,
			position: 1,
			target: {
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: null,
				restSec: null,
				durationMin: 10,
				distanceM: null,
			},
			lastSets: null,
			lastPerformedAt: null,
			isBodyweight: null,
			progressHintKg: null,
		},
	],
})

const makeProgram = (): ProgramResponse => ({
	id: VERSION_ID,
	title: null,
	mode: 'ROTATE',
	perWeek: 2,
	pinnedTemplateId: null,
	version: { id: VERSION_ID, createdAt: '2026-10-31T19:15:00.000Z' },
	templates: [makeTemplate(TEMPLATE_A, 'Тренування А'), makeTemplate(TEMPLATE_B, 'Тренування Б')],
	next: { templateId: TEMPLATE_B, weekday: null, date: null, isToday: false },
})

const makeProfileBody = (trainingOnboardingAt: string | null) => ({
	email: 'user@example.com',
	name: null,
	addressAs: null,
	profile: {
		sex: null,
		age: null,
		heightCm: null,
		activityLevel: null,
		targetWeightKg: null,
		goalType: null,
		paceKgPerWeek: null,
	},
	weight: null,
	waist: null,
	goals: null,
	trainingOnboardingAt,
})

interface ApiExtras {
	/** null = no program; an Error = the program request fails. */
	program?: ProgramResponse | null | Error
	trainingOnboardingAt?: string | null
}

const TODAY = '2026-10-26'

const statsReply = (workoutCount: number): AxiosResponse => ({
	...reply(null),
	data: { data: makeWorkoutStats({ overview: { ...makeWorkoutStats().overview, workoutCount } }) },
})

/** The journal and the stats tile ask different URLs: the journal gets `workouts`, the tile `stats`. */
const mockApi = (
	workouts: WorkoutResponse[] | Error,
	statsCount: number | Error = 11,
	{ program = null, trainingOnboardingAt = ANSWERED_AT }: ApiExtras = {},
) => {
	getMock.mockImplementation((url: string) => {
		if (url === '/programs/active') {
			return program instanceof Error ? Promise.reject(program) : Promise.resolve(reply(program))
		}
		if (url === '/profile') {
			return Promise.resolve(reply(makeProfileBody(trainingOnboardingAt)))
		}
		if (url === '/workouts/stats') {
			return statsCount instanceof Error
				? Promise.reject(statsCount)
				: Promise.resolve(statsReply(statsCount))
		}
		return workouts instanceof Error ? Promise.reject(workouts) : Promise.resolve(reply(workouts))
	})
}

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

// seeded, so the page does not ask the (spied) http client for the session first
const user: AuthUser = {
	id: '0199b3a4-0000-7000-8000-00000000000a',
	email: 'user@example.com',
	name: null,
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T10:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

const renderPage = (onPathname?: (pathname: string) => void) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	queryClient.setQueryData(SESSION_QUERY_KEY, user)
	return renderWithProviders(<TrainingPage />, { route: ROUTES.training, onPathname, queryClient })
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date(`${TODAY}T12:00:00+01:00`))
})

afterEach(() => {
	vi.useRealTimers()
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))

		renderPage()

		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
		expect(screen.getByRole('heading', { name: 'Тренування' })).toBeTruthy()
	})

	it('shows the week card and the trainings by month, each row a link to its session', async () => {
		mockApi([
			makeWorkout({
				id: '0199b3a4-0000-7000-8000-0000000000f2',
				localDate: '2026-09-30',
				place: 'HOME',
				durationMin: 30,
				exercises: [makeExercise({ muscleGroup: 'BACK' })],
			}),
			makeWorkout({
				id: '0199b3a4-0000-7000-8000-0000000000f3',
				localDate: TODAY,
				exercises: [makeExercise({ muscleGroup: 'CHEST', record: 'WEIGHT' })],
			}),
		])

		renderPage()

		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
		expect(screen.getByText('1 тренування · 55 хв')).toBeTruthy()
		expect(screen.getByText('Жовтень')).toBeTruthy()
		expect(screen.getByText('Вересень')).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Понеділок, 26 жовтня: тренування — груди' }),
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Вівторок, 27 жовтня: тренувань не було' }),
		).toBeTruthy()
		const links = screen
			.getAllByRole('link')
			.filter((link) => link.getAttribute('href') !== TRAINING_STATS_ROUTE)
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/app/training/0199b3a4-0000-7000-8000-0000000000f3',
			'/app/training/0199b3a4-0000-7000-8000-0000000000f2',
		])
		expect(within(links[0] as HTMLElement).getByText('Зал · 55 хв')).toBeTruthy()
		expect(getMock).toHaveBeenCalledWith('/workouts', {
			params: { from: '2026-09-01', to: TODAY },
		})
	})

	it('shows the stats tile under the week card with the month count, a link to the stats', async () => {
		mockApi([makeWorkout({ localDate: TODAY })], 11, { program: new Error('network') })

		renderPage()

		const tile = await screen.findByRole('link', { name: /Статистика/ })
		expect(tile.getAttribute('href')).toBe('/app/training/stats')
		expect(await within(tile).findByText('11 тренувань за жовтень')).toBeTruthy()
	})

	it('shortens the month count when the program tile sits beside the stats tile', async () => {
		mockApi([makeWorkout({ localDate: TODAY })], 11)

		renderPage()

		const tile = await screen.findByRole('link', { name: /Статистика/ })
		expect(await within(tile).findByText('11 за жовтень')).toBeTruthy()
		expect(within(tile).queryByText(/тренувань/)).toBeNull()
	})

	it('keeps the tile with the title only when the count fails', async () => {
		mockApi([makeWorkout({ localDate: TODAY })], new Error('network'))

		renderPage()

		const tile = await screen.findByRole('link', { name: 'Статистика' })
		expect(tile.getAttribute('href')).toBe('/app/training/stats')
		expect(screen.queryByText(/за жовтень/)).toBeNull()
	})

	it('says nothing was trained this week when only older days are there', async () => {
		mockApi([makeWorkout({ localDate: '2026-10-20' })])

		renderPage()

		expect(await screen.findByText('ще без тренувань')).toBeTruthy()
	})

	it('shows the empty state with a way to the chat', async () => {
		mockApi([])
		const onPathname = vi.fn()

		renderPage(onPathname)

		expect(await screen.findByText('Тут будуть твої тренування')).toBeTruthy()
		expect(screen.getByText('Цей тиждень: ще без тренувань')).toBeTruthy()
		expect(screen.queryByRole('link', { name: /Статистика/ })).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Написати в чат' }))
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.chat)
	})

	it('shows the error in place of the journal and retries', async () => {
		getMock.mockRejectedValueOnce(new Error('network'))
		mockApi([makeWorkout()])

		renderPage()

		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.getByRole('alert')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
	})

	it('puts the next template, the templates and the program tile on top when there is a program', async () => {
		mockApi([makeWorkout({ localDate: TODAY, templateName: 'Тренування А' })], 11, {
			program: makeProgram(),
		})

		renderPage()

		const next = await screen.findByRole('region', { name: 'Наступне' })
		const nextLink = within(next).getByRole('link', {
			name: 'Тренування Б · 1 вправа + кардіо · ~55 хв',
		})
		expect(nextLink.getAttribute('href')).toBe(getTrainingTemplatePath(TEMPLATE_B))
		expect(within(next).getByText('Жим гантелей')).toBeTruthy()
		expect(within(next).getByText('Доріжка')).toBeTruthy()

		expect(screen.getByText('Мої шаблони')).toBeTruthy()
		expect(screen.getByRole('link', { name: /програма/ }).getAttribute('href')).toBe(
			TRAINING_PROGRAM_ROUTE,
		)
		const rowA = screen.getByRole('link', {
			name: 'Тренування А. 1 вправа + кардіо · ~55 хв. Кардіо, Груди',
		})
		expect(rowA.getAttribute('href')).toBe(getTrainingTemplatePath(TEMPLATE_A))

		const tile = screen.getByRole('link', { name: /Програма/ })
		expect(tile.getAttribute('href')).toBe(TRAINING_PROGRAM_ROUTE)
		expect(within(tile).getByText('Версія від 31.10')).toBeTruthy()
		const statsTile = screen.getByRole('link', { name: /Статистика/ })
		expect(await within(statsTile).findByText('11 за жовтень')).toBeTruthy()
		expect(screen.queryByText('Налаштуємо тренування?')).toBeNull()
	})

	it('shows the template name small after the title of a program day, and speaks it', async () => {
		mockApi([makeWorkout({ localDate: TODAY, templateName: 'Тренування А' })])

		renderPage()

		const name = await screen.findByText('Тренування А', { selector: 'span' })
		expect(name.className).toContain('text-muted')
		expect(name.className).not.toContain('font-bold')
		expect(screen.getByText('Зал · 55 хв').className).toContain('font-bold')
		expect(screen.getByRole('link', { name: /Зал · 55 хв · Тренування А/ })).toBeTruthy()
	})

	it('hides the program blocks when the program fails, the journal keeps working', async () => {
		mockApi([makeWorkout({ localDate: TODAY })], 11, { program: new Error('network') })

		renderPage()

		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
		expect(screen.queryByText('Мої шаблони')).toBeNull()
		expect(screen.queryByText('Програма')).toBeNull()
		expect(screen.queryByRole('region', { name: 'Наступне' })).toBeNull()
	})

	it('shows the program skeleton while the program loads', async () => {
		getMock.mockImplementation((url: string) =>
			url === '/programs/active'
				? new Promise(() => undefined)
				: Promise.resolve(reply([makeWorkout({ localDate: TODAY })])),
		)

		renderPage()

		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('invites to the setup on a first visit without a program and a training', async () => {
		mockApi([], 0, { trainingOnboardingAt: null })
		onboardingMock.start.mockResolvedValue({})
		const onPathname = vi.fn()

		renderPage(onPathname)

		expect(await screen.findByText('Налаштуємо тренування?')).toBeTruthy()
		expect(screen.queryByText('Тут будуть твої тренування')).toBeNull()
		expect(screen.queryByText('Цей тиждень: ще без тренувань')).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Налаштувати в чаті' }))
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.chat)
		})
		expect(onboardingMock.start).toHaveBeenCalledTimes(1)
	})

	it('falls back to the empty state after «Пізніше» and keeps the setup as a tile', async () => {
		mockApi([], 0, { trainingOnboardingAt: null })
		onboardingMock.dismiss.mockImplementation(() => {
			mockApi([], 0, { trainingOnboardingAt: ANSWERED_AT })
			return Promise.resolve()
		})

		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Пізніше' }))

		expect(await screen.findByText('Тут будуть твої тренування')).toBeTruthy()
		expect(screen.queryByText('Налаштуємо тренування?')).toBeNull()
		expect(screen.getByRole('button', { name: /Програма/ })).toBeTruthy()
	})

	it('offers «Налаштувати» as a tile without a program once the invitation is answered', async () => {
		mockApi([makeWorkout({ localDate: TODAY })])
		onboardingMock.start.mockResolvedValue({})
		const onPathname = vi.fn()

		renderPage(onPathname)

		const tile = await screen.findByRole('button', { name: /Програма/ })
		expect(within(tile).getByText('Налаштувати')).toBeTruthy()
		fireEvent.click(tile)
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(ROUTES.chat)
		})
	})

	it('keeps the journal and no invitation when there are trainings but no program and no answer', async () => {
		mockApi([makeWorkout({ localDate: TODAY })], 11, { trainingOnboardingAt: null })

		renderPage()

		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
		expect(screen.queryByText('Налаштуємо тренування?')).toBeNull()
		expect(screen.getByRole('button', { name: /Програма/ })).toBeTruthy()
	})
})

describe('TrainingPage week strip', () => {
	const FIRST = '0199b3a4-0000-7000-8000-0000000000e1'
	const SECOND = '0199b3a4-0000-7000-8000-0000000000e2'

	it('opens the sheet «Тренування дня» with every training when the day has several', async () => {
		mockApi([
			makeWorkout({ id: FIRST, localDate: TODAY, startedAt: '2026-10-26T07:10:00.000Z' }),
			makeWorkout({
				id: SECOND,
				localDate: TODAY,
				place: 'HOME',
				durationMin: 30,
				startedAt: '2026-10-26T17:30:00.000Z',
			}),
		])
		const onPathname = vi.fn()

		renderPage(onPathname)

		fireEvent.click(
			await screen.findByRole('button', { name: /^Понеділок, 26 жовтня: тренування/ }),
		)

		const list = await screen.findByRole('list', { name: 'Тренування дня' })
		const hrefs = within(list)
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'))
		expect(hrefs).toHaveLength(2)
		expect(hrefs).toContain(`/app/training/${FIRST}`)
		expect(hrefs).toContain(`/app/training/${SECOND}`)
		expect(onPathname).not.toHaveBeenCalledWith(`/app/training/${FIRST}`)
	})

	it('goes straight to the training when the day has one', async () => {
		mockApi([makeWorkout({ id: FIRST, localDate: TODAY })])
		const onPathname = vi.fn()

		renderPage(onPathname)

		fireEvent.click(
			await screen.findByRole('button', { name: /^Понеділок, 26 жовтня: тренування/ }),
		)

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(`/app/training/${FIRST}`)
		})
		expect(screen.queryByRole('list', { name: 'Тренування дня' })).toBeNull()
	})

	it('does nothing on a day without a training', async () => {
		mockApi([makeWorkout({ id: FIRST, localDate: TODAY })])
		const onPathname = vi.fn()

		renderPage(onPathname)

		const quietDay = await screen.findByRole('button', {
			name: 'Вівторок, 27 жовтня: тренувань не було',
		})
		fireEvent.click(quietDay)

		expect(quietDay.getAttribute('aria-disabled')).toBe('true')
		expect(screen.queryByRole('list', { name: 'Тренування дня' })).toBeNull()
		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
	})

	it('cannot go forward from the current week, and can come back from the previous one', async () => {
		mockApi([makeWorkout({ id: FIRST, localDate: '2026-10-20' })])

		renderPage()

		await screen.findByText('Цей тиждень')
		const next = screen.getByRole('button', { name: 'Наступний тиждень' })
		expect(next.hasAttribute('disabled')).toBe(true)

		fireEvent.click(screen.getByRole('button', { name: 'Попередній тиждень' }))

		expect(screen.queryByText('Цей тиждень')).toBeNull()
		expect(screen.getByText('1 тренування · 55 хв')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Наступний тиждень' }).hasAttribute('disabled')).toBe(
			false,
		)
		fireEvent.click(screen.getByRole('button', { name: 'Наступний тиждень' }))
		expect(await screen.findByText('Цей тиждень')).toBeTruthy()
	})

	it('marks a program day ahead as planned on a WEEKDAYS program', async () => {
		const program = makeProgram()
		mockApi([makeWorkout({ id: FIRST, localDate: TODAY })], 11, {
			program: {
				...program,
				mode: 'WEEKDAYS',
				templates: program.templates.map((template, index) => ({
					...template,
					weekdays: index === 0 ? [3] : [],
				})),
			},
		})

		renderPage()

		expect(
			await screen.findByRole('button', { name: 'Середа, 28 жовтня: день за програмою' }),
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Четвер, 29 жовтня: тренувань не було' }),
		).toBeTruthy()
	})
})
