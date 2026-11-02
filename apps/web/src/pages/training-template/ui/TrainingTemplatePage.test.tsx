// @vitest-environment jsdom
import type { ProgramExerciseResponse, ProgramResponse } from '@kus/shared'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TRAINING_PROGRAM_ROUTE, TRAINING_TEMPLATE_ROUTE } from '@/shared/config'
import { renderWithProviders } from '@/shared/testing'

import { TrainingTemplatePage } from './TrainingTemplatePage'

const getMock = vi.spyOn(httpClient, 'get')
const postMock = vi.spyOn(httpClient, 'post')

const TEMPLATE_ID = '0199b3a4-0000-7000-8000-00000000000a'
const NEW_TEMPLATE_ID = '0199b3a4-0000-7000-8000-00000000000b'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000c1'
const TEMPLATE_PATH = `/app/training/template/${TEMPLATE_ID}`

const makeExercise = (
	position: number,
	name: string,
	patch: Partial<ProgramExerciseResponse> = {},
): ProgramExerciseResponse => ({
	id: `0199b3a4-0000-7000-8000-0000000001${position}0`,
	exerciseId: null,
	name,
	kind: 'STRENGTH',
	muscleGroup: 'LEGS',
	position,
	target: {
		sets: 3,
		repsMin: 10,
		repsMax: 12,
		weightKg: 120,
		progressStepKg: 5,
		restSec: 120,
		durationMin: null,
		distanceM: null,
	},
	lastSets: [
		{ reps: 12, weightKg: 120, isWarmup: false },
		{ reps: 12, weightKg: 120, isWarmup: false },
	],
	lastPerformedAt: '2026-10-30T10:00:00.000Z',
	isBodyweight: null,
	progressHintKg: null,
	...patch,
})

const makeProgram = (templateId = TEMPLATE_ID): ProgramResponse => ({
	id: VERSION_ID,
	title: null,
	mode: 'ROTATE',
	perWeek: null,
	pinnedTemplateId: null,
	version: { id: VERSION_ID, createdAt: '2026-10-31T19:15:00.000Z' },
	templates: [
		{
			id: templateId,
			key: TEMPLATE_ID,
			name: 'Тренування Б',
			position: 0,
			weekdays: [],
			estimatedMin: 55,
			muscleGroups: ['LEGS'],
			hasCardio: false,
			exercises: [
				makeExercise(0, 'Жим ногами'),
				makeExercise(1, 'Підйоми ніг у висі', {
					muscleGroup: 'CORE',
					target: {
						sets: 3,
						repsMin: 10,
						repsMax: 15,
						weightKg: null,
						progressStepKg: null,
						restSec: 60,
						durationMin: null,
						distanceM: null,
					},
				}),
			],
		},
	],
	next: null,
})

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const mockProgram = (program: ProgramResponse | null = makeProgram()) => {
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/programs/active' ? program : [])),
	)
}

const renderPage = (onPathname?: (pathname: string) => void, route = TEMPLATE_PATH) =>
	renderWithProviders(
		<Routes>
			<Route path={TRAINING_TEMPLATE_ROUTE} element={<TrainingTemplatePage />} />
		</Routes>,
		{ route, onPathname },
	)

const startEditing = async (): Promise<void> => {
	fireEvent.click(await screen.findByRole('button', { name: 'Змінити' }))
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('TrainingTemplatePage', () => {
	it('shows the day: the name, the meta, the exercises with their plan and the legend', async () => {
		mockProgram()
		renderPage()

		expect(await screen.findByRole('heading', { name: 'Тренування Б' })).toBeTruthy()
		expect(screen.getByText('2 вправи · ~55 хв')).toBeTruthy()
		expect(screen.getByText('3 × 10–12 · 120 кг · +5 кг · 120 с')).toBeTruthy()
		expect(screen.getByText('3 × 10–15 · 60 с')).toBeTruthy()
		expect(
			screen.getByText('Ціль: підходи × повтори · робоча вага · крок прогресу · відпочинок.'),
		).toBeTruthy()
	})

	it('shows a skeleton while loading and an error with a retry', async () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()
		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
		cleanup()

		getMock.mockRejectedValue(new Error('offline'))
		renderPage()
		expect(await screen.findByText('Не вдалося завантажити тренування.')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy()
	})

	it('goes back to the program for a day that is not in the active version', async () => {
		mockProgram()
		const onPathname = vi.fn()
		renderPage(onPathname, '/app/training/template/0199b3a4-0000-7000-8000-0000000000ff')

		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(TRAINING_PROGRAM_ROUTE)
		})
	})

	it('opens the editor with «Готово», the handles, the removers and the hint', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		expect(screen.getByRole('button', { name: 'Готово' }).className).toContain('min-h-tap')
		expect(screen.getByRole('button', { name: 'Перетягнути: Жим ногами' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Прибрати: Жим ногами' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Вправа' })).toBeTruthy()
		expect(screen.getByText(/Перетягни за ≡/)).toBeTruthy()
	})

	it('leaves the editor without a request when nothing changed', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		expect(await screen.findByRole('button', { name: 'Змінити' })).toBeTruthy()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('removes an exercise and saves a new version based on the current one', async () => {
		mockProgram()
		postMock.mockResolvedValue(reply(makeProgram(NEW_TEMPLATE_ID)))
		const onPathname = vi.fn()
		renderPage(onPathname)
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати: Жим ногами' }))
		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		const [url, body] = postMock.mock.calls[0] ?? []
		expect(url).toBe('/programs/active/versions')
		expect(body).toMatchObject({ baseVersionId: VERSION_ID, templateId: TEMPLATE_ID })
		expect((body as { exercises: { name: string }[] }).exercises.map((item) => item.name)).toEqual([
			'Підйоми ніг у висі',
		])
		// the new version gives the day a new id: the address follows it
		await waitFor(() => {
			expect(onPathname).toHaveBeenLastCalledWith(`/app/training/template/${NEW_TEMPLATE_ID}`)
		})
		expect(await screen.findByRole('button', { name: 'Змінити' })).toBeTruthy()
	})

	it('moves an exercise with ↑ / ↓ on its handle and says where it is now', async () => {
		mockProgram()
		postMock.mockResolvedValue(reply(makeProgram()))
		renderPage()
		await startEditing()

		fireEvent.keyDown(screen.getByRole('button', { name: 'Перетягнути: Жим ногами' }), {
			key: 'ArrowDown',
		})

		expect(await screen.findByText('Жим ногами: позиція 2 з 2')).toBeTruthy()
		const handles = screen.getAllByRole('button', { name: /^Перетягнути:/ })
		expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
			'Перетягнути: Підйоми ніг у висі',
			'Перетягнути: Жим ногами',
		])

		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))
		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		const body = postMock.mock.calls[0]?.[1] as { exercises: { name: string }[] }
		expect(body.exercises.map((item) => item.name)).toEqual(['Підйоми ніг у висі', 'Жим ногами'])
	})

	it('does not move the first exercise up', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		fireEvent.keyDown(screen.getByRole('button', { name: 'Перетягнути: Жим ногами' }), {
			key: 'ArrowUp',
		})

		expect(screen.queryByText(/позиція/)).toBeNull()
	})

	it('does not steal the focus later after a move that was ignored at the edge', async () => {
		mockProgram()
		renderPage()
		await startEditing()
		const first = screen.getByRole('button', { name: 'Перетягнути: Жим ногами' })
		const second = screen.getByRole('button', { name: 'Перетягнути: Підйоми ніг у висі' })
		expect(first.getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown')

		fireEvent.keyDown(first, { key: 'ArrowUp' })
		second.focus()
		fireEvent.keyDown(second, { key: 'ArrowUp' })

		expect(await screen.findByText('Підйоми ніг у висі: позиція 1 з 2')).toBeTruthy()
		await waitFor(() => {
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'Перетягнути: Підйоми ніг у висі' }),
			)
		})
	})

	it('sets the target in the sheet and saves it with the list', async () => {
		mockProgram()
		postMock.mockResolvedValue(reply(makeProgram()))
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: /^Жим ногами/ }))
		const sheet = await screen.findByRole('dialog', { name: 'Жим ногами' })
		expect(within(sheet).getByText('Минулого разу:')).toBeTruthy()
		fireEvent.click(within(sheet).getByRole('button', { name: 'Більше: Підходи' }))
		fireEvent.click(within(sheet).getByRole('button', { name: '+2,5 кг' }))
		fireEvent.click(within(sheet).getByRole('button', { name: '60 с' }))
		fireEvent.click(within(sheet).getByRole('button', { name: 'Зберегти' }))
		await waitFor(() => {
			expect(screen.queryByRole('dialog', { name: 'Жим ногами' })).toBeNull()
		})
		expect(postMock).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		const body = postMock.mock.calls[0]?.[1] as {
			exercises: { name: string; target: Record<string, unknown> }[]
		}
		expect(body.exercises[0]?.target).toMatchObject({
			sets: 4,
			weightKg: 120,
			progressStepKg: 2.5,
			restSec: 60,
		})
	})

	it('keeps the repetitions range valid and hides the progress step without a weight', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: /^Підйоми ніг у висі/ }))
		const sheet = await screen.findByRole('dialog', { name: 'Підйоми ніг у висі' })

		expect(within(sheet).queryByText('Крок прогресу')).toBeNull()
		fireEvent.click(within(sheet).getByRole('button', { name: 'Менше: до' }))
		for (let tap = 0; tap < 6; tap += 1) {
			fireEvent.click(within(sheet).getByRole('button', { name: 'Менше: до' }))
		}
		expect(within(sheet).getByRole('group', { name: 'Повтори від' }).textContent).toContain('8')
	})

	it('removes an exercise from the sheet', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: /^Жим ногами/ }))
		const sheet = await screen.findByRole('dialog', { name: 'Жим ногами' })
		fireEvent.click(within(sheet).getByRole('button', { name: 'Прибрати з тренування' }))

		await waitFor(() => {
			expect(screen.queryByRole('button', { name: 'Прибрати: Жим ногами' })).toBeNull()
		})
		expect(await screen.findByRole('button', { name: 'Прибрати: Підйоми ніг у висі' })).toBeTruthy()
	})

	it('disables «Готово» when every exercise was removed', async () => {
		mockProgram()
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати: Жим ногами' }))
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати: Підйоми ніг у висі' }))

		expect(screen.getByRole('button', { name: 'Готово' }).hasAttribute('disabled')).toBe(true)
	})

	it('tells about a program changed elsewhere, refreshes it and leaves the editor', async () => {
		mockProgram()
		postMock.mockRejectedValue(
			new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
				status: 409,
				statusText: 'Conflict',
				headers: {},
				config: { headers: new AxiosHeaders() },
				data: { statusCode: 409, errorCode: 'PROGRAM_VERSION_CONFLICT', details: {} },
			}),
		)
		renderPage()
		await startEditing()
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати: Жим ногами' }))
		getMock.mockClear()

		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		expect(
			await screen.findByText('Програму щойно змінено — відкрий шаблон і внеси правки ще раз.'),
		).toBeTruthy()
		expect(await screen.findByRole('button', { name: 'Змінити' })).toBeTruthy()
		await waitFor(() => {
			expect(getMock).toHaveBeenCalledWith('/programs/active')
		})
	})

	it('adds an exercise from «Мої вправи» with the last weight and the defaults', async () => {
		getMock.mockImplementation((url: string) => {
			if (url === '/workouts/exercises') {
				return Promise.resolve(
					reply([
						{
							id: '0199b3a4-0000-7000-8000-000000000f01',
							name: 'Тяга верхнього блока',
							kind: 'STRENGTH',
							muscleGroup: 'BACK',
							lastSets: [{ reps: 12, weightKg: 45, isWarmup: false }],
							lastCardio: null,
						},
						{
							id: '0199b3a4-0000-7000-8000-000000000f02',
							name: 'Гіперекстензія',
							kind: 'STRENGTH',
							muscleGroup: 'BACK',
							lastSets: null,
							lastCardio: null,
						},
					]),
				)
			}
			return Promise.resolve(reply(url === '/programs/active' ? makeProgram() : []))
		})
		postMock.mockResolvedValue(reply(makeProgram()))
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: 'Вправа' }))
		const sheet = await screen.findByRole('dialog', { name: 'Вправа' })
		expect(await within(sheet).findByText('45×12')).toBeTruthy()
		expect(within(sheet).getByText('ще не було')).toBeTruthy()
		fireEvent.click(within(sheet).getByRole('button', { name: 'Додати: Тяга верхнього блока' }))
		await waitFor(() => {
			expect(screen.queryByRole('dialog', { name: 'Вправа' })).toBeNull()
		})
		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		const body = postMock.mock.calls[0]?.[1] as {
			exercises: { name: string; exerciseId: string | null; target: Record<string, unknown> }[]
		}
		expect(body.exercises).toHaveLength(3)
		expect(body.exercises[2]).toMatchObject({
			name: 'Тяга верхнього блока',
			exerciseId: '0199b3a4-0000-7000-8000-000000000f01',
			target: { sets: 3, repsMin: 8, repsMax: 12, weightKg: 45, progressStepKg: 2.5, restSec: 90 },
		})
	})

	it('offers a new exercise for a name that is not in the list and adds it without an id', async () => {
		getMock.mockImplementation((url: string) =>
			Promise.resolve(reply(url === '/programs/active' ? makeProgram() : [])),
		)
		postMock.mockResolvedValue(reply(makeProgram()))
		renderPage()
		await startEditing()

		fireEvent.click(screen.getByRole('button', { name: 'Вправа' }))
		const sheet = await screen.findByRole('dialog', { name: 'Вправа' })
		fireEvent.change(within(sheet).getByRole('textbox', { name: 'Пошук вправи' }), {
			target: { value: 'Тяга гантелі' },
		})
		fireEvent.click(
			await within(sheet).findByRole('button', { name: 'Нова вправа «Тяга гантелі»' }),
		)
		await waitFor(() => {
			expect(screen.queryByRole('dialog', { name: 'Вправа' })).toBeNull()
		})
		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		const body = postMock.mock.calls[0]?.[1] as {
			exercises: { name: string; exerciseId: string | null; muscleGroup: string | null }[]
		}
		expect(body.exercises[2]).toMatchObject({
			name: 'Тяга гантелі',
			exerciseId: null,
			muscleGroup: 'BACK',
		})
	})
})
