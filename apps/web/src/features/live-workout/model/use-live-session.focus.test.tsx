// @vitest-environment jsdom
import type { LiveWorkoutResponse } from '@kus/shared'
import { act, cleanup } from '@testing-library/react'
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

import type { LiveSetRef } from '../lib/live-set-helpers'
import { useLiveWorkoutStore } from './live-workout-store'
import { useLiveSession } from './use-live-session'

const putMock = vi.spyOn(httpClient, 'put')

const templateId = (n: number): string => `0199b3a4-0000-7000-8000-00000000a0${n}`

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const CARDIO = 0
const BENCH = 1
const LEGS = 2
const SHOULDERS = 3

/** The author's day: a warm-up cardio, then bench, legs, shoulders (2 sets each). */
const makePlanLive = (): LiveWorkoutResponse =>
	makeLiveResponse({
		workout: makeWorkout({ source: 'LIVE', durationMin: null, exercises: [] }),
		plan: [
			makePlanExercise({
				templateExerciseId: templateId(0),
				name: 'Розминка (доріжка)',
				kind: 'CARDIO',
				muscleGroup: null,
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				durationMin: 10,
			}),
			makePlanExercise({ templateExerciseId: templateId(1), name: 'Жим', sets: 2 }),
			makePlanExercise({
				templateExerciseId: templateId(2),
				name: 'Присід',
				muscleGroup: 'LEGS',
				sets: 2,
			}),
			makePlanExercise({
				templateExerciseId: templateId(3),
				name: 'Плечі',
				muscleGroup: 'SHOULDERS',
				sets: 2,
			}),
		],
	})

beforeEach(() => {
	useLiveWorkoutStore.setState({ snapshots: {} })
	putMock.mockImplementation(() => Promise.resolve(reply(makePlanLive())))
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	useLiveWorkoutStore.setState({ snapshots: {} })
})

const setup = () => renderHookWithProviders(() => useLiveSession(makePlanLive()))

type Hook = ReturnType<typeof setup>['result']

const tick = (result: Hook, ref: LiveSetRef): void => {
	act(() => {
		result.current.toggleDone(ref)
	})
}

const tickBoth = (result: Hook, exerciseIndex: number): void => {
	tick(result, { exerciseIndex, setIndex: 0 })
	tick(result, { exerciseIndex, setIndex: 1 })
}

describe('useLiveSession: what is in hand', () => {
	it('starts on the planned cardio, not on the first strength set', () => {
		const { result } = setup()

		expect(result.current.current).toEqual({ exerciseIndex: CARDIO, setIndex: 0 })
	})

	it('«+» on the cardio keeps it in hand', () => {
		const { result } = setup()

		act(() => {
			result.current.changeCardioMinutes(CARDIO, 11)
		})

		expect(result.current.draft.exercises[CARDIO]?.durationMin).toBe(11)
		expect(result.current.current).toEqual({ exerciseIndex: CARDIO, setIndex: 0 })
	})

	it('a ✓ on shoulders keeps shoulders in hand with its next set', () => {
		const { result } = setup()
		act(() => {
			result.current.selectExercise(SHOULDERS)
		})

		tick(result, { exerciseIndex: SHOULDERS, setIndex: 0 })

		expect(result.current.current).toEqual({ exerciseIndex: SHOULDERS, setIndex: 1 })
	})

	it('the last set of shoulders goes to legs, the next undone exercise after it', () => {
		const { result } = setup()
		// cardio is begun and bench is done: the wrap after shoulders finds legs
		act(() => {
			result.current.changeCardioMinutes(CARDIO, 10)
		})
		tickBoth(result, BENCH)
		tickBoth(result, SHOULDERS)

		expect(result.current.current).toEqual({ exerciseIndex: LEGS, setIndex: 0 })
	})

	it('wraps to the start when nothing is left ahead', () => {
		const { result } = setup()
		tickBoth(result, LEGS)
		tickBoth(result, SHOULDERS)

		expect(result.current.current).toEqual({ exerciseIndex: CARDIO, setIndex: 0 })
	})

	it('the very last set of the session leaves nothing in hand', () => {
		const { result } = setup()
		act(() => {
			result.current.changeCardioMinutes(CARDIO, 10)
		})
		tickBoth(result, BENCH)
		tickBoth(result, LEGS)
		tickBoth(result, SHOULDERS)

		expect(result.current.current).toBeNull()
	})

	it('removing a ✓ stays on the same set', () => {
		const { result } = setup()
		act(() => {
			result.current.selectExercise(SHOULDERS)
		})
		tick(result, { exerciseIndex: SHOULDERS, setIndex: 0 })

		tick(result, { exerciseIndex: SHOULDERS, setIndex: 0 })

		expect(result.current.current).toEqual({ exerciseIndex: SHOULDERS, setIndex: 0 })
	})
})

describe('useLiveSession: the chat rewrites the session', () => {
	it('forgets a kept selection (indices only) and falls back to the first thing to do', () => {
		let live = makePlanLive()
		const { result, rerender } = renderHookWithProviders(() => useLiveSession(live))
		act(() => {
			result.current.selectSet({ exerciseIndex: SHOULDERS, setIndex: 1 })
		})
		expect(result.current.current).toEqual({ exerciseIndex: SHOULDERS, setIndex: 1 })

		live = {
			...live,
			editedAt: '2026-11-02T10:05:00.000Z',
			workout: {
				...live.workout,
				exercises: [makeExercise({ name: 'Від чату', clientKey: null })],
			},
		}
		rerender()

		expect(result.current.current).toEqual({ exerciseIndex: CARDIO, setIndex: 0 })
	})
})
