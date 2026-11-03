// @vitest-environment jsdom
import type { WorkoutFinished } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { PROGRAM_QUERY_KEY } from '@/entities/program'
import { playSound } from '@/shared/lib'
import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { WorkoutFinishScreen } from './WorkoutFinishScreen'

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	playSound: vi.fn(),
}))

const MESSAGE_ID = '0199b3a4-0000-7000-8000-0000000000aa'

const makeFinished = (
	overrides: Partial<WorkoutFinished> = {},
	workout = makeWorkout({ durationMin: 55 }),
): WorkoutFinished => ({
	workout,
	messageId: MESSAGE_ID,
	hasNewRecord: false,
	...overrides,
})

const renderScreen = (finished: WorkoutFinished, onDone = vi.fn()) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	renderWithProviders(<WorkoutFinishScreen finished={finished} onDone={onDone} />, { queryClient })
	return { invalidate, onDone }
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('WorkoutFinishScreen', () => {
	it('a new record: the proud hamster and the achieve sound', () => {
		renderScreen(makeFinished({ hasNewRecord: true }))

		expect(screen.getByRole('img', { name: "Хом'як гордий" })).toBeTruthy()
		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('achieve')
	})

	it('no record: the happy hamster and no sound', () => {
		renderScreen(makeFinished({ hasNewRecord: false }))

		expect(screen.getByRole('img', { name: "Хом'як радіє" })).toBeTruthy()
		expect(playSound).not.toHaveBeenCalled()
	})

	it('reads the chat feed and the program again on mount', () => {
		const { invalidate } = renderScreen(makeFinished())

		expect(invalidate).toHaveBeenCalledWith({ queryKey: MESSAGES_QUERY_KEY })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: PROGRAM_QUERY_KEY })
	})

	it('shows the kcal line through KcalNote: an estimate with its source, bold number', () => {
		const workout = makeWorkout({ kcal: { value: 350, source: 'ESTIMATE' } })

		renderScreen(makeFinished({}, workout))

		const bold = screen.getByText('≈ 350 ккал')
		expect(bold.tagName).toBe('B')
		expect(bold.parentElement?.textContent).toBe('≈ 350 ккал · оцінка')
	})

	it('a number the person named reads «зі слів»', () => {
		const workout = makeWorkout({ kcal: { value: 380, source: 'MANUAL' } })

		renderScreen(makeFinished({}, workout))

		expect(screen.getByText('380 ккал').parentElement?.textContent).toBe('380 ккал · зі слів')
	})

	it('shows no kcal line at all without a number', () => {
		renderScreen(makeFinished())

		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('shows the records of the session', () => {
		const workout = makeWorkout({ exercises: [makeExercise({ record: 'WEIGHT' })] })

		renderScreen(makeFinished({ hasNewRecord: true }, workout))

		expect(screen.getByText(/^Рекорд: жим лежачи/)).toBeTruthy()
	})

	it('«Готово» calls onDone and a link opens the finished training', () => {
		const { onDone } = renderScreen(makeFinished())

		fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

		expect(onDone).toHaveBeenCalledTimes(1)
		expect(screen.getByRole('link', { name: 'Відкрити тренування' }).getAttribute('href')).toBe(
			`/app/training/${makeWorkout().id}`,
		)
	})
})
