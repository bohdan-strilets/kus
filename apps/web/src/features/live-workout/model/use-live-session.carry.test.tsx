// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { act, cleanup, waitFor } from '@testing-library/react'
import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/shared/api'
import {
	makeExercise,
	makeLiveResponse,
	makePlanExercise,
	makeWorkout,
	renderHookWithProviders,
} from '@/shared/testing'

import { useLiveWorkoutStore } from './live-workout-store'
import { useLiveSession } from './use-live-session'

const putMock = vi.spyOn(httpClient, 'put')

const TEMPLATE_ID = '0199b3a4-0000-7000-8000-00000000a001'

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const makeLive = (): LiveWorkoutResponse =>
	makeLiveResponse({
		workout: makeWorkout({ source: 'LIVE', durationMin: null, exercises: [] }),
		plan: [
			makePlanExercise({
				templateExerciseId: TEMPLATE_ID,
				name: 'Жим',
				sets: 3,
				repsMin: 8,
				repsMax: 8,
				weightKg: 70,
			}),
		],
	})

const weights = (draft: { exercises: { sets: { weightKg: number | null }[] }[] }): unknown[] =>
	draft.exercises[0]?.sets.map((set) => set.weightKg) ?? []

beforeEach(() => {
	useLiveWorkoutStore.setState({ snapshots: {} })
	putMock.mockImplementation(() => Promise.resolve(reply(makeLive())))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	useLiveWorkoutStore.setState({ snapshots: {} })
})

describe('useLiveSession: the weight is carried to the next set', () => {
	it('3 x 70, set 2 changed to 80 and done: set 3 shows 80 and the ✓ is one commit', async () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))
		expect(weights(result.current.draft)).toEqual([70, 70, 70])

		act(() => {
			result.current.changeSet({ exerciseIndex: 0, setIndex: 1 }, { weightKg: 80 })
		})
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(1)
		})

		act(() => {
			result.current.toggleDone({ exerciseIndex: 0, setIndex: 1 })
		})

		expect(weights(result.current.draft)).toEqual([70, 80, 80])
		await waitFor(() => {
			expect(putMock).toHaveBeenCalledTimes(2)
		})
		const body = putMock.mock.calls[1]?.[1] as {
			exercises: { sets: { weightKg: number | null; doneAt: string | null }[] }[]
		}
		expect(body.exercises[0]?.sets.map((set) => set.weightKg)).toEqual([70, 80, 80])
		expect(body.exercises[0]?.sets[1]?.doneAt).not.toBeNull()
		expect(body.exercises[0]?.sets[2]?.doneAt).toBeNull()
		expect(JSON.stringify(body)).not.toContain('isEdited')
	})

	it('taking a ✓ back carries nothing', () => {
		const { result } = renderHookWithProviders(() => useLiveSession(makeLive()))
		act(() => {
			result.current.toggleDone({ exerciseIndex: 0, setIndex: 0 })
		})
		act(() => {
			result.current.changeSet({ exerciseIndex: 0, setIndex: 0 }, { weightKg: 90 })
		})
		act(() => {
			result.current.toggleDone({ exerciseIndex: 0, setIndex: 0 })
		})

		expect(weights(result.current.draft)).toEqual([90, 70, 70])
	})

	it('after the chat rewrites the session the flag is reset: an edited set is carried into again', () => {
		let live = makeLive()
		const { result, rerender } = renderHookWithProviders(() => useLiveSession(live))
		const clientKey = result.current.draft.exercises[0]?.clientKey ?? null
		expect(clientKey).not.toBeNull()

		act(() => {
			result.current.changeSet({ exerciseIndex: 0, setIndex: 2 }, { weightKg: 75 })
		})

		live = {
			...live,
			editedAt: '2026-11-02T10:05:00.000Z',
			workout: {
				...live.workout,
				exercises: [
					makeExercise({
						clientKey,
						templateExerciseId: TEMPLATE_ID,
						sets: [1, 2, 3].map(() => ({
							reps: 8,
							weightKg: 70,
							durationSec: null,
							distanceM: null,
							isWarmup: false,
							doneAt: null,
						})),
					}),
				],
			},
		}
		rerender()
		expect(weights(result.current.draft)).toEqual([70, 70, 70])

		act(() => {
			result.current.changeSet({ exerciseIndex: 0, setIndex: 1 }, { weightKg: 80 })
		})
		act(() => {
			result.current.toggleDone({ exerciseIndex: 0, setIndex: 1 })
		})

		expect(weights(result.current.draft)).toEqual([70, 80, 80])
	})
})
