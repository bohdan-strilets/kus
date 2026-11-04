// @vitest-environment jsdom
import type { LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	makeExercise,
	makeLiveResponse,
	makeWorkout,
	renderHookWithProviders,
} from '@/shared/testing'

import { useLiveWorkoutStore } from './live-workout-store'
import { useLiveSession } from './use-live-session'

const putMock = vi.spyOn(httpClient, 'put')

const KEY_A = '0199b3a4-0000-7000-8000-0000000000d1'
const KEY_B = '0199b3a4-0000-7000-8000-0000000000d2'
const ID_1 = '0199b3a4-0000-7000-8000-0000000000e1'
const ID_2 = '0199b3a4-0000-7000-8000-0000000000e2'
const ID_3 = '0199b3a4-0000-7000-8000-0000000000e3'
const KEY_CHAT_OWNER = null

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const setsOf = (...reps: number[]) =>
	reps.map((value) => ({
		reps: value,
		weightKg: 50,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt: null,
	}))

const makeLive = (): LiveWorkoutResponse =>
	makeLiveResponse({
		workout: makeWorkout({
			source: 'LIVE',
			durationMin: null,
			exercises: [
				makeExercise({ id: ID_1, name: 'Жим', clientKey: KEY_A, sets: setsOf(1, 2, 3) }),
				makeExercise({ id: ID_2, name: 'Тяга', clientKey: KEY_B, sets: setsOf(4, 5) }),
				makeExercise({ id: ID_3, name: 'Від чату', clientKey: KEY_CHAT_OWNER }),
			],
		}),
	})

const lastBody = (): LiveWorkoutUpdate => putMock.mock.calls.at(-1)?.[1] as LiveWorkoutUpdate

const bodyAt = (call: number): LiveWorkoutUpdate =>
	putMock.mock.calls[call]?.[1] as LiveWorkoutUpdate

const repsInBody = (body: LiveWorkoutUpdate, clientKey: string): (number | null)[] =>
	body.exercises.find((exercise) => exercise.clientKey === clientKey)?.sets.map((s) => s.reps) ?? []

const waitForPuts = async (count: number): Promise<void> => {
	await waitFor(() => {
		expect(putMock).toHaveBeenCalledTimes(count)
	})
}

const pressUndo = (): void => {
	fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
}

beforeEach(() => {
	useLiveWorkoutStore.setState({ snapshots: {} })
	putMock.mockImplementation(() => Promise.resolve(reply(makeLive())))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	useLiveWorkoutStore.setState({ snapshots: {} })
})

describe('useLiveSession: deleting an exercise goes out as a PUT snapshot', () => {
	it('delete sends the snapshot without it; undo sends it back once, with the same clientKey', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteExercise(0)
		})
		await waitForPuts(1)

		expect(bodyAt(0).exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_B])
		expect(result.current.draft.exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_B, null])
		expect(await screen.findByText('Вправу видалено')).toBeTruthy()

		pressUndo()
		await waitForPuts(2)

		const keys = bodyAt(1).exercises.map(({ clientKey }) => clientKey)
		expect(keys).toEqual([KEY_A, KEY_B])
		expect(new Set(keys).size).toBe(keys.length)
		expect(repsInBody(bodyAt(1), KEY_A)).toEqual([1, 2, 3])
		expect(result.current.draft.exercises.map(({ clientKey }) => clientKey)).toEqual([
			KEY_A,
			KEY_B,
			null,
		])
	})

	it('a second undo press (the toast is gone after the first) adds nothing', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))
		act(() => {
			result.current.deleteExercise(0)
		})
		await waitForPuts(1)
		const undo = await screen.findByRole('button', { name: 'Скасувати' })

		fireEvent.click(undo)
		fireEvent.click(undo)
		await waitForPuts(2)

		expect(lastBody().exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_A, KEY_B])
		expect(
			result.current.draft.exercises.filter(({ clientKey }) => clientKey === KEY_A),
		).toHaveLength(1)
	})

	it('an undo made while the delete PUT is still in flight ends with the full snapshot', async () => {
		let release: (value: AxiosResponse) => void = () => undefined
		putMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteExercise(1)
		})
		await waitForPuts(1)
		pressUndo()
		act(() => {
			release(reply(makeLive()))
		})
		await waitForPuts(2)

		expect(bodyAt(0).exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_A])
		expect(lastBody().exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_A, KEY_B])
		expect(repsInBody(lastBody(), KEY_B)).toEqual([4, 5])
	})

	it('a chat exercise cannot be deleted: no PUT, no toast', () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteExercise(2)
		})

		expect(putMock).not.toHaveBeenCalled()
		expect(screen.queryByText('Вправу видалено')).toBeNull()
		expect(result.current.draft.exercises).toHaveLength(3)
	})

	it('an index with no exercise does nothing', () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteExercise(9)
		})

		expect(putMock).not.toHaveBeenCalled()
	})

	it('a new deletion replaces the toast: only the last one can be undone', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteExercise(0)
		})
		await waitForPuts(1)
		act(() => {
			result.current.deleteExercise(0)
		})
		await waitForPuts(2)

		expect(bodyAt(1).exercises).toEqual([])
		// the replaced toast leaves after its exit animation
		await waitFor(() => {
			expect(screen.getAllByRole('button', { name: 'Скасувати' })).toHaveLength(1)
		})

		pressUndo()
		await waitForPuts(3)

		// only the last removed exercise (B) is back; A stays gone
		expect(lastBody().exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_B])
	})
})

describe('useLiveSession: deleting a set goes out as a PUT snapshot', () => {
	it('delete sends the exercise with one set less; undo sends the same number as before', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 1 })
		})
		await waitForPuts(1)

		expect(repsInBody(bodyAt(0), KEY_A)).toEqual([1, 3])
		expect(await screen.findByText('Підхід 2 видалено')).toBeTruthy()

		pressUndo()
		await waitForPuts(2)

		expect(repsInBody(bodyAt(1), KEY_A)).toEqual([1, 2, 3])
		expect(repsInBody(bodyAt(1), KEY_B)).toEqual([4, 5])
		expect(result.current.draft.exercises[0]?.sets).toHaveLength(3)
	})

	it('a repeated undo press does not add a second copy of the set', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))
		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 0 })
		})
		await waitForPuts(1)
		const undo = await screen.findByRole('button', { name: 'Скасувати' })

		fireEvent.click(undo)
		fireEvent.click(undo)
		await waitForPuts(2)

		// FINDING if red: restoreSet has no once-only guard, a double press inserts the set twice
		expect(result.current.draft.exercises[0]?.sets).toHaveLength(3)
		expect(repsInBody(lastBody(), KEY_A)).toEqual([1, 2, 3])
	})

	it('the toast numbers working sets only: a warm-up has its own text', async () => {
		const live = makeLive()
		const warm = { ...setsOf(9)[0], isWarmup: true }
		const exercise = live.workout.exercises[0]
		if (exercise) exercise.sets = [warm as (typeof exercise.sets)[number], ...setsOf(1, 2)]
		const { result } = renderHookWithProviders(() => useLiveSession(live))

		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 2 })
		})

		expect(await screen.findByText('Підхід 2 видалено')).toBeTruthy()
		await waitForPuts(1)
		cleanup()
		const second = renderHookWithProviders(() => useLiveSession(live))
		act(() => {
			second.result.current.deleteSet({ exerciseIndex: 0, setIndex: 0 })
		})
		expect(await screen.findByText('Розминку видалено')).toBeTruthy()
	})

	it('a done set comes back done', async () => {
		const live = makeLive()
		const doneAt = '2026-11-02T09:20:00.000Z'
		const exercise = live.workout.exercises[0]
		if (exercise)
			exercise.sets = exercise.sets.map((s, index) => (index === 0 ? { ...s, doneAt } : s))
		const { result } = renderHookWithProviders(() => useLiveSession(live))

		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 0 })
		})
		await waitForPuts(1)
		pressUndo()
		await waitForPuts(2)

		expect(lastBody().exercises[0]?.sets[0]?.doneAt).toBe(doneAt)
	})

	it('a chat exercise loses no set: no PUT, no toast', () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteSet({ exerciseIndex: 2, setIndex: 0 })
		})

		expect(putMock).not.toHaveBeenCalled()
		expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
	})

	it('a set that is not there does nothing', () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))

		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 7 })
		})

		expect(putMock).not.toHaveBeenCalled()
	})

	it('undo after the exercise itself was deleted brings no set into the list', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))
		act(() => {
			result.current.deleteSet({ exerciseIndex: 0, setIndex: 0 })
		})
		await waitForPuts(1)
		const undoSet = await screen.findByRole('button', { name: 'Скасувати' })
		act(() => {
			result.current.deleteExercise(0)
		})
		await waitForPuts(2)

		fireEvent.click(undoSet)

		expect(result.current.draft.exercises.map(({ clientKey }) => clientKey)).toEqual([KEY_B, null])
	})
})
