// @vitest-environment jsdom
import type { ProgramExerciseResponse, ProgramResponse } from '@kus/shared'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import { TRAINING_TEMPLATE_ROUTE } from '@/shared/config'
import { renderWithProviders } from '@/shared/testing'

import { TrainingTemplatePage } from './TrainingTemplatePage'

const getMock = vi.spyOn(httpClient, 'get')
const postMock = vi.spyOn(httpClient, 'post')

const TEMPLATE_ID = '0199b3a4-0000-7000-8000-00000000000a'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000c1'
const TEMPLATE_PATH = `/app/training/template/${TEMPLATE_ID}`
const LONG_OLD_NAME = 'Груди, плечі й трицепс — важкий день, а ще трохи кардіо'
const FIELD_LABEL = 'Назва тренування'
const TOO_LONG_MESSAGE = 'Назва — до 40 символів'

const exercise: ProgramExerciseResponse = {
	id: '0199b3a4-0000-7000-8000-000000000100',
	exerciseId: null,
	name: 'Жим ногами',
	kind: 'STRENGTH',
	muscleGroup: 'LEGS',
	position: 0,
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
	lastSets: null,
	lastPerformedAt: null,
	isBodyweight: null,
	progressHintKg: null,
}

const makeProgram = (name: string, position: number): ProgramResponse => ({
	id: VERSION_ID,
	title: null,
	mode: 'ROTATE',
	perWeek: null,
	pinnedTemplateId: null,
	version: { id: VERSION_ID, createdAt: '2026-10-31T19:15:00.000Z' },
	templates: [
		{
			id: TEMPLATE_ID,
			key: TEMPLATE_ID,
			name,
			position,
			weekdays: [],
			estimatedMin: 55,
			muscleGroups: ['LEGS'],
			hasCardio: false,
			exercises: [
				exercise,
				{
					...exercise,
					id: '0199b3a4-0000-7000-8000-000000000101',
					name: 'Присідання',
					position: 1,
				},
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

const renderTemplate = (name: string, position: number): void => {
	const program = makeProgram(name, position)
	getMock.mockImplementation((url: string) =>
		Promise.resolve(reply(url === '/programs/active' ? program : [])),
	)
	postMock.mockResolvedValue(reply(program))
	renderWithProviders(
		<Routes>
			<Route path={TRAINING_TEMPLATE_ROUTE} element={<TrainingTemplatePage />} />
		</Routes>,
		{ route: TEMPLATE_PATH },
	)
}

const openEditor = async (name: string, position = 1): Promise<HTMLInputElement> => {
	renderTemplate(name, position)
	fireEvent.click(await screen.findByRole('button', { name: 'Змінити' }))
	return screen.getByLabelText<HTMLInputElement>(FIELD_LABEL)
}

const type = (field: HTMLInputElement, value: string): void => {
	fireEvent.change(field, { target: { value } })
}

const done = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'Готово' }))
}

const sentBody = (): Record<string, unknown> =>
	postMock.mock.calls[0]?.[1] as Record<string, unknown>

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('template name in the editor', () => {
	it('is the first field, filled with the saved name', async () => {
		const field = await openEditor('Верх тіла')
		expect(field.value).toBe('Верх тіла')
	})

	it('is not in the view mode', async () => {
		renderTemplate('Верх тіла', 1)
		await screen.findByRole('button', { name: 'Змінити' })
		expect(screen.queryByLabelText(FIELD_LABEL)).toBeNull()
	})

	it('lets «Готово» pass with an old long name and does not send the name', async () => {
		const field = await openEditor(LONG_OLD_NAME)
		expect(field.value).toBe(LONG_OLD_NAME)
		expect(screen.queryByText(TOO_LONG_MESSAGE)).toBeNull()

		done()

		expect(await screen.findByRole('button', { name: 'Змінити' })).toBeTruthy()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('shows the error under the field for a changed name over 40 and sends nothing', async () => {
		const field = await openEditor('Верх тіла')
		type(field, 'а'.repeat(41))

		expect(await screen.findByText(TOO_LONG_MESSAGE)).toBeTruthy()
		done()

		await waitFor(() => {
			expect(screen.getByText(TOO_LONG_MESSAGE)).toBeTruthy()
		})
		expect(postMock).not.toHaveBeenCalled()
		expect(screen.getByRole('button', { name: 'Готово' }).hasAttribute('disabled')).toBe(false)
	})

	it('saves a rename alone as a new version with the trimmed name', async () => {
		const field = await openEditor('Тренування Б')
		type(field, '  Ноги й спина ')
		done()

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		expect(sentBody()).toMatchObject({ baseVersionId: VERSION_ID, name: 'Ноги й спина' })
	})

	it('saves the default name of its position when the field is emptied', async () => {
		const field = await openEditor('Верх тіла', 1)
		type(field, '   ')
		done()

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		expect(sentBody()).toMatchObject({ name: 'Тренування Б' })
	})

	it('does not send the name when only the exercises changed', async () => {
		await openEditor('Верх тіла')
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати: Жим ногами' }))
		done()

		await waitFor(() => {
			expect(postMock).toHaveBeenCalledTimes(1)
		})
		expect(sentBody()).not.toHaveProperty('name')
	})

	it('offers «Повернути» only while the name differs from the default one', async () => {
		const field = await openEditor('Верх тіла', 1)
		const restore = screen.getByRole('button', { name: 'Повернути «Тренування Б»' })

		fireEvent.click(restore)

		expect(field.value).toBe('Тренування Б')
		expect(screen.queryByRole('button', { name: /^Повернути/ })).toBeNull()
		expect(postMock).not.toHaveBeenCalled()
	})

	it('shows the counter from the 30th character', async () => {
		const field = await openEditor('Верх тіла')
		expect(screen.queryByText(/ \/ 40$/)).toBeNull()
		type(field, 'а'.repeat(30))
		expect(await screen.findByText('30 / 40')).toBeTruthy()
	})
})
