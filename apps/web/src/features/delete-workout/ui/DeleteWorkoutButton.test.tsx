// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { makeWorkout, renderWithProviders } from '@/shared/testing'

import { deleteWorkout } from '../api/delete-workout'
import { DeleteWorkoutButton } from './DeleteWorkoutButton'

vi.mock('../api/delete-workout', () => ({ deleteWorkout: vi.fn() }))

const deleteMock = vi.mocked(deleteWorkout)
// no start time keeps the name independent of the test machine's time zone
const workout = makeWorkout({ startedAt: null })

const renderButton = () => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	renderWithProviders(<DeleteWorkoutButton workout={workout} />, { queryClient })
	return { invalidate }
}

const openDialog = async () => {
	await userEvent.click(screen.getByRole('button', { name: 'Видалити тренування «Зал»' }))
}

beforeEach(() => {
	deleteMock.mockReset()
})

afterEach(cleanup)

describe('DeleteWorkoutButton', () => {
	it('asks first and sends nothing when the user cancels', async () => {
		renderButton()
		await openDialog()

		expect(screen.getByText('Видалити тренування?')).toBeTruthy()
		expect(
			screen.getByText(
				'«Зал» зникне з вкладки «Тренування» і зі «Сьогодні». Повернути можна словами в чаті.',
			),
		).toBeTruthy()
		await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		expect(deleteMock).not.toHaveBeenCalled()
		await waitFor(() => {
			expect(screen.queryByText('Видалити тренування?')).toBeNull()
		})
	})

	it('deletes, refreshes the tab, the chat and the day, and closes without a toast', async () => {
		deleteMock.mockResolvedValue(undefined)
		const { invalidate } = renderButton()
		await openDialog()

		await userEvent.click(screen.getByRole('button', { name: 'Видалити' }))

		await waitFor(() => {
			expect(deleteMock.mock.calls[0]?.[0]).toBe(workout.id)
		})
		await waitFor(() => {
			expect(screen.queryByText('Видалити тренування?')).toBeNull()
		})
		const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey)
		expect(keys).toContainEqual(WORKOUTS_QUERY_KEY)
		expect(keys).toContainEqual(MESSAGES_QUERY_KEY)
		expect(keys).toContainEqual(DAY_QUERY_KEY)
		expect(screen.queryByRole('status')).toBeNull()
	})

	it('shows a toast and still refreshes when the delete fails', async () => {
		deleteMock.mockRejectedValue(new Error('boom'))
		const { invalidate } = renderButton()
		await openDialog()

		await userEvent.click(screen.getByRole('button', { name: 'Видалити' }))

		await waitFor(() => {
			expect(screen.getByText('Не вдалося видалити тренування. Спробуй ще раз.')).toBeTruthy()
		})
		expect(invalidate).toHaveBeenCalled()
	})
})
