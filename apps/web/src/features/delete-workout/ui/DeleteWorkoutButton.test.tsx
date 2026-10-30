// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DAY_QUERY_KEY } from '@/entities/day'
import { MESSAGES_QUERY_KEY } from '@/entities/message'
import { WORKOUTS_QUERY_KEY } from '@/entities/workout'
import { OVERLAY_HOLD_MAX_MS, useOverlayStore } from '@/shared/lib'
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

afterEach(() => {
	cleanup()
	useOverlayStore.setState({ count: 0 })
})

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

describe('DeleteWorkoutButton and the chat feed', () => {
	// confirmDelete spends 600 ms on the dialog exit before the checks start
	const SLOW_REFETCH_MS = 5000
	const HOLD_MAX_MS = OVERLAY_HOLD_MAX_MS

	afterEach(() => {
		vi.useRealTimers()
	})

	const renderSlow = (refetchMs: number | null) => {
		vi.useFakeTimers({ shouldAdvanceTime: true })
		deleteMock.mockResolvedValue(undefined)
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		// refetchMs null: a refetch that never finishes
		vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					if (refetchMs !== null) setTimeout(resolve, refetchMs)
				}),
		)
		const view = renderWithProviders(<DeleteWorkoutButton workout={workout} />, { queryClient })
		return view
	}

	const confirmDelete = async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
		await user.click(screen.getByRole('button', { name: 'Видалити тренування «Зал»' }))
		await user.click(screen.getByRole('button', { name: 'Видалити' }))
		// the dialog closes and plays its exit animation
		await act(async () => {
			await vi.advanceTimersByTimeAsync(600)
		})
	}

	it('covers the feed while the dialog is open, and until the card is gone', async () => {
		const view = renderSlow(SLOW_REFETCH_MS)
		expect(useOverlayStore.getState().count).toBe(0)

		await confirmDelete()
		// the dialog is closed, yet the feed is held: the refetch has not turned the card into a line
		expect(useOverlayStore.getState().count).toBe(1)

		// the card is replaced by a line: the button unmounts and the feed is let go (and pinned)
		view.unmount()
		expect(useOverlayStore.getState().count).toBe(0)
	})

	it('keeps holding the feed when the refetch takes longer than three seconds', async () => {
		renderSlow(SLOW_REFETCH_MS)

		await confirmDelete()
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3500)
		})
		expect(useOverlayStore.getState().count).toBe(1)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000)
		})
		await waitFor(() => {
			expect(useOverlayStore.getState().count).toBe(0)
		})
	})

	it('lets the feed go after eight seconds when the refetch hangs', async () => {
		renderSlow(null)

		await confirmDelete()
		await act(async () => {
			await vi.advanceTimersByTimeAsync(HOLD_MAX_MS - 1500)
		})
		expect(useOverlayStore.getState().count).toBe(1)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(2000)
		})
		expect(useOverlayStore.getState().count).toBe(0)
	})
})
