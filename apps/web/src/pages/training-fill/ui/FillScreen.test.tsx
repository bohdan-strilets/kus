// @vitest-environment jsdom
import { MAX_EXERCISES_PER_WORKOUT, MAX_SETS_PER_EXERCISE } from '@kus/shared'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import {
	makeTemplate,
	makeTemplateExercise,
	makeWorkout,
	renderWithProviders,
	TEMPLATE_ID,
} from '@/shared/testing'

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

const httpError = (status: number, errorCode: string, details = {}): AxiosError => {
	const config = { headers: new AxiosHeaders() }
	return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, {
		status,
		statusText: String(status),
		headers: {},
		config,
		data: { statusCode: status, errorCode, details },
	})
}

const finished = () => reply({ workout: makeWorkout(), messageId: MESSAGE_ID, hasNewRecord: false })

const twoExerciseTemplate = () =>
	makeTemplate({
		exercises: [
			makeTemplateExercise(),
			makeTemplateExercise({
				id: '0199b3a4-0000-7000-8000-0000000000b2',
				name: 'Присід',
				muscleGroup: 'LEGS',
				position: 1,
			}),
		],
	})

const renderScreen = (template = makeTemplate(), onPathname?: (pathname: string) => void) =>
	renderWithProviders(<FillScreen template={template} now={NOW} />, { onPathname })

const rowButton = (name: string): HTMLElement =>
	screen.getByRole('button', { name: new RegExp(`^${name}`) })

const save = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
}

const lastBody = (): { clientRequestId: string; exercises: { name: string }[] } & Record<
	string,
	unknown
> => postMock.mock.calls.at(-1)?.[1] as never

beforeEach(() => {
	postMock.mockResolvedValue(finished())
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('FillScreen: the plan', () => {
	it('shows the template, when, duration and the exercise as the plan says', () => {
		renderScreen()

		expect(screen.getByText('Верх А')).toBeTruthy()
		expect(screen.getByText('Сьогодні · 17:35')).toBeTruthy()
		expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Тривалість/ }).value).toBe('55')
		expect(rowButton('Жим лежачи').textContent).toContain('3 підходи · 50 кг × 10')
		expect(screen.getByRole('button', { name: 'Як за планом' }).getAttribute('aria-pressed')).toBe(
			'true',
		)
	})

	it('an empty session says «Тренування» and has no exercises', () => {
		renderWithProviders(<FillScreen template={null} now={NOW} />)

		expect(screen.getByText('Тренування')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Як за планом' })).toBeNull()
		expect(screen.getByRole<HTMLInputElement>('textbox', { name: /Тривалість/ }).value).toBe('')
	})

	it('saves the plan as it is and shows the summary screen', async () => {
		renderScreen()

		save()

		expect(await screen.findByRole('button', { name: 'Готово' })).toBeTruthy()
		expect(postMock).toHaveBeenCalledTimes(1)
		expect(postMock.mock.calls[0]?.[0]).toBe('/workout-forms')
		const body = lastBody()
		expect(body).toMatchObject({
			templateId: TEMPLATE_ID,
			localDate: '2026-11-02',
			startTime: '17:35',
			durationMin: 55,
		})
		expect(body.exercises).toHaveLength(1)
		expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
	})

	it('the summary «Готово» goes back to the training tab', async () => {
		const onPathname = vi.fn()
		renderScreen(makeTemplate(), onPathname)
		save()

		fireEvent.click(await screen.findByRole('button', { name: 'Готово' }))

		expect(onPathname).toHaveBeenLastCalledWith(ROUTES.training)
	})
})

describe('FillScreen: layout', () => {
	it('the swipe rows are not direct children of the scroll column, so they are never squeezed', () => {
		renderScreen()

		const row = rowButton('Жим лежачи').closest('[data-swipe-row]')
		const list = row?.parentElement

		expect(row).toBeTruthy()
		expect(list?.className).not.toContain('overflow-y-auto')
		expect(list?.parentElement?.className).toContain('overflow-y-auto')
		expect(list?.parentElement?.classList.contains('flex')).toBe(false)
	})
})

describe('FillScreen: focus after deleting an exercise', () => {
	const getMock = vi.spyOn(httpClient, 'get')

	const addExercise = async (name: string): Promise<void> => {
		fireEvent.click(screen.getByRole('button', { name: 'Вправа' }))
		fireEvent.change(await screen.findByRole('textbox', { name: 'Пошук вправи' }), {
			target: { value: name },
		})
		fireEvent.click(await screen.findByRole('button', { name: `Нова вправа «${name}»` }))
		await screen.findByRole('button', { name: new RegExp(`^${name}`) })
	}

	const deleteExercise = (name: string): void => {
		fireEvent.click(rowButton(name))
		fireEvent.click(
			screen.getAllByRole('button', { name: `Видалити вправу «${name}»` })[0] as HTMLElement,
		)
	}

	const renderWithAdded = async (names: string[]): Promise<void> => {
		getMock.mockResolvedValue(reply([]))
		renderScreen()
		for (const name of names) await addExercise(name)
	}

	it('deleting a middle exercise focuses the one that took its place (the row count comes from the wrapper)', async () => {
		await renderWithAdded(['Альфа', 'Браво', 'Чарлі'])

		deleteExercise('Браво')

		await waitFor(() => {
			expect(screen.queryByRole('button', { name: /^Браво/ })).toBeNull()
		})
		await waitFor(() => {
			expect(document.activeElement).toBe(rowButton('Чарлі'))
		})
	})

	it('deleting the last exercise focuses the previous one', async () => {
		await renderWithAdded(['Альфа', 'Браво'])

		deleteExercise('Браво')

		await waitFor(() => {
			expect(document.activeElement).toBe(rowButton('Альфа'))
		})
	})

	it('deleting the first added exercise focuses the next added one, not the planned one above', async () => {
		await renderWithAdded(['Альфа', 'Браво'])

		deleteExercise('Альфа')

		await waitFor(() => {
			expect(document.activeElement).toBe(rowButton('Браво'))
		})
	})

	it('deleting the only added exercise focuses the planned one above it', async () => {
		await renderWithAdded(['Альфа'])

		deleteExercise('Альфа')

		await waitFor(() => {
			expect(document.activeElement).toBe(rowButton('Жим лежачи'))
		})
	})
})

describe('FillScreen: deviations', () => {
	it('a changed set turns «Як за планом» off and says what changed', () => {
		renderScreen()
		fireEvent.click(rowButton('Жим лежачи'))

		fireEvent.click(screen.getByRole('button', { name: 'Підхід 2, змінити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))

		expect(screen.getByRole('button', { name: 'Як за планом' }).getAttribute('aria-pressed')).toBe(
			'false',
		)
		expect(screen.getByText('Змінено: 2-й підхід · план: 3 підходи · 50 кг × 10')).toBeTruthy()
	})

	it('names two changed sets «2-й і 3-й підходи»', () => {
		renderScreen()
		fireEvent.click(rowButton('Жим лежачи'))

		fireEvent.click(screen.getByRole('button', { name: 'Підхід 2, змінити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 3, змінити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))

		expect(
			screen.getByText('Змінено: 2-й і 3-й підходи · план: 3 підходи · 50 кг × 10'),
		).toBeTruthy()
		// the set in hand is a block, the other one is a row with the mark
		expect(screen.getAllByText('змінено')).toHaveLength(1)
	})

	it('«Як за планом» brings the plan back', () => {
		renderScreen()
		fireEvent.click(rowButton('Жим лежачи'))
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 2, змінити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))

		fireEvent.click(screen.getByRole('button', { name: 'Як за планом' }))

		expect(screen.getByRole('button', { name: 'Як за планом' }).getAttribute('aria-pressed')).toBe(
			'true',
		)
		expect(screen.queryByText(/^Змінено:/)).toBeNull()
	})

	it('«+ Підхід» changes the set count, not the set ordinals', () => {
		renderScreen()
		fireEvent.click(rowButton('Жим лежачи'))

		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))

		expect(screen.getByText('Змінено: 4 підходи замість 3')).toBeTruthy()
	})

	it('«Не робили» skips the exercise: «не робили» and «Повернути»; it is not sent', async () => {
		renderScreen(twoExerciseTemplate())
		fireEvent.click(rowButton('Присід'))

		fireEvent.click(screen.getByRole('button', { name: 'Не робили' }))

		expect(screen.getByText('не робили')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Повернути' })).toBeTruthy()

		save()
		await screen.findByRole('button', { name: 'Готово' })

		expect(lastBody().exercises.map((exercise) => exercise.name)).toEqual(['Жим лежачи'])
	})

	it('«Повернути» returns a skipped exercise to the plan', () => {
		renderScreen(twoExerciseTemplate())
		fireEvent.click(rowButton('Присід'))
		fireEvent.click(screen.getByRole('button', { name: 'Не робили' }))

		fireEvent.click(screen.getByRole('button', { name: 'Повернути' }))

		expect(screen.queryByText('не робили')).toBeNull()
		expect(screen.getAllByRole('button', { name: 'Як за планом' })).toHaveLength(2)
	})

	it('all exercises skipped: the hint shows after pressing «Зберегти», nothing is sent, the button stays enabled', async () => {
		renderScreen()
		fireEvent.click(rowButton('Жим лежачи'))
		fireEvent.click(screen.getByRole('button', { name: 'Не робили' }))

		const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Зберегти' })
		expect(button.disabled).toBe(false)
		expect(screen.queryByText('Познач хоча б одну вправу')).toBeNull()

		fireEvent.click(button)

		expect(await screen.findByText('Познач хоча б одну вправу')).toBeTruthy()
		expect(postMock).not.toHaveBeenCalled()
		expect(button.disabled).toBe(false)
	})

	it('an empty duration is reported after pressing «Зберегти» and nothing is sent', async () => {
		renderScreen()
		const input = screen.getByRole('textbox', { name: /Тривалість/ })
		fireEvent.change(input, { target: { value: '' } })

		save()

		expect(await screen.findByText('Вкажи тривалість')).toBeTruthy()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('typing letters in the duration keeps only digits', () => {
		renderScreen()
		const input = screen.getByRole<HTMLInputElement>('textbox', { name: /Тривалість/ })

		fireEvent.change(input, { target: { value: '4a5' } })

		expect(input.value).toBe('45')
	})
})

describe('FillScreen: wording of the changed sets', () => {
	const bigTemplate = (sets: number) =>
		makeTemplate({
			exercises: [
				makeTemplateExercise({
					target: {
						sets,
						repsMin: 8,
						repsMax: 10,
						weightKg: 50,
						progressStepKg: null,
						restSec: null,
						durationMin: null,
						distanceM: null,
					},
				}),
			],
		})

	const changeSets = (numbers: number[]): void => {
		fireEvent.click(rowButton('Жим лежачи'))
		for (const n of numbers) {
			fireEvent.click(screen.getByRole('button', { name: `Підхід ${n}, змінити` }))
			fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))
		}
	}

	it('three changed sets: «1-й, 2-й і 3-й підходи»', () => {
		renderScreen(bigTemplate(3))
		changeSets([1, 2, 3])

		expect(
			screen.getByText('Змінено: 1-й, 2-й і 3-й підходи · план: 3 підходи · 50 кг × 10'),
		).toBeTruthy()
	})

	it('five changed sets use the «many» form: «підходів»', () => {
		renderScreen(bigTemplate(5))
		changeSets([1, 2, 3, 4, 5])

		expect(
			screen.getByText(
				'Змінено: 1-й, 2-й, 3-й, 4-й і 5-й підходів · план: 5 підходів · 50 кг × 10',
			),
		).toBeTruthy()
	})
})

describe('FillScreen: limits', () => {
	it('«+ Вправа» is disabled at the exercise limit and keeps its tap target', () => {
		const exercises = Array.from({ length: MAX_EXERCISES_PER_WORKOUT }, (_, n) =>
			makeTemplateExercise({
				id: `0199b3a4-0000-7000-8000-${String(500 + n).padStart(12, '0')}`,
				name: `Вправа ${n + 1}`,
				position: n,
			}),
		)
		renderScreen(makeTemplate({ exercises }))

		const add = screen.getByRole<HTMLButtonElement>('button', { name: 'Вправа' })

		expect(add.disabled).toBe(true)
		expect(add.className).toContain('min-h-button')
	})

	it('«+ Вправа» works below the limit', () => {
		renderScreen()

		expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Вправа' }).disabled).toBe(false)
	})

	it('«+ Підхід» is disabled at the set limit', () => {
		renderScreen(
			makeTemplate({
				exercises: [
					makeTemplateExercise({
						target: {
							sets: MAX_SETS_PER_EXERCISE,
							repsMin: 8,
							repsMax: 10,
							weightKg: 50,
							progressStepKg: null,
							restSec: null,
							durationMin: null,
							distanceM: null,
						},
					}),
				],
			}),
		)
		fireEvent.click(rowButton('Жим лежачи'))

		expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Підхід' }).disabled).toBe(true)
	})

	it('«+ Підхід» adds the last allowed set and then locks', () => {
		renderScreen(
			makeTemplate({
				exercises: [
					makeTemplateExercise({
						target: {
							sets: MAX_SETS_PER_EXERCISE - 1,
							repsMin: 8,
							repsMax: 10,
							weightKg: 50,
							progressStepKg: null,
							restSec: null,
							durationMin: null,
							distanceM: null,
						},
					}),
				],
			}),
		)
		fireEvent.click(rowButton('Жим лежачи'))

		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))

		expect(screen.getByRole<HTMLButtonElement>('button', { name: '+ Підхід' }).disabled).toBe(true)
	})
})

describe('FillScreen: saving and errors', () => {
	it('repeats the same request id when «Зберегти» is pressed again after a failure', async () => {
		postMock.mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
		renderScreen()

		save()
		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		await screen.findByText(/Немає зв/)
		save()
		await screen.findByRole('button', { name: 'Готово' })

		expect(postMock).toHaveBeenCalledTimes(2)
		const [first, second] = postMock.mock.calls.map(
			([, body]) => (body as { clientRequestId: string }).clientRequestId,
		)
		expect(first).toBeTruthy()
		expect(second).toBe(first)
	})

	it('a new form gets a new request id', async () => {
		renderScreen()
		save()
		await screen.findByRole('button', { name: 'Готово' })
		const first = lastBody().clientRequestId
		cleanup()

		renderScreen()
		save()
		await screen.findByRole('button', { name: 'Готово' })

		expect(lastBody().clientRequestId).not.toBe(first)
	})

	it('puts a server 422 on the field: the day', async () => {
		postMock.mockRejectedValueOnce(
			httpError(422, 'VALIDATION_ERROR', { fields: { localDate: 'OUT_OF_RANGE' } }),
		)
		renderScreen()

		save()

		expect(await screen.findByText('Обери сьогодні або один із трьох попередніх днів')).toBeTruthy()
	})

	it('puts a server 422 on the field: the start', async () => {
		postMock.mockRejectedValueOnce(
			httpError(422, 'VALIDATION_ERROR', { fields: { startTime: 'IN_FUTURE' } }),
		)
		renderScreen()

		save()

		expect(await screen.findByText('Початок у майбутньому — вкажи раніше.')).toBeTruthy()
	})

	it('a failure the form has no field for is a toast, and the form stays', async () => {
		postMock.mockRejectedValueOnce(httpError(500, 'INTERNAL_ERROR'))
		renderScreen()

		save()

		expect(await screen.findByText('Не вийшло. Спробуй ще раз.')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy()
	})
})

describe('FillScreen: «Коли»', () => {
	const openWhen = (): HTMLElement => {
		fireEvent.click(screen.getByRole('button', { name: /Коли/ }))
		return screen.getByRole('dialog')
	}

	it('offers today and three days back and applies the day and the time with «Готово»', async () => {
		renderScreen()
		const sheet = openWhen()

		expect(
			within(sheet)
				.getAllByRole('button')
				.map((button) => button.textContent),
		).toEqual(expect.arrayContaining(['Сьогодні', 'Вчора']))
		fireEvent.click(within(sheet).getByRole('button', { name: 'Вчора' }))
		fireEvent.change(within(sheet).getByLabelText('Початок'), { target: { value: '17:05' } })
		fireEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))

		await waitFor(() => {
			expect(screen.getByText('Вчора · 17:05')).toBeTruthy()
		})
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull()
		})
		save()
		await screen.findByRole('button', { name: 'Готово' })
		expect(lastBody()).toMatchObject({ localDate: '2026-11-01', startTime: '17:05' })
	})

	it('closing without «Готово» changes nothing, and the next opening starts from the form', async () => {
		renderScreen()
		const sheet = openWhen()
		fireEvent.click(within(sheet).getByRole('button', { name: 'Вчора' }))
		fireEvent.change(within(sheet).getByLabelText('Початок'), { target: { value: '07:00' } })

		fireEvent.keyDown(sheet, { key: 'Escape' })

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull()
		})
		expect(screen.getByText('Сьогодні · 17:35')).toBeTruthy()

		const reopened = openWhen()
		expect(within(reopened).getByLabelText<HTMLInputElement>('Початок').value).toBe('17:35')
	})

	it('a start in the future (today) is reported after «Готово» without a save', async () => {
		renderScreen()
		const sheet = openWhen()
		fireEvent.change(within(sheet).getByLabelText('Початок'), { target: { value: '23:00' } })
		fireEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))

		expect(await screen.findByText('Початок у майбутньому — вкажи раніше.')).toBeTruthy()
	})
})
