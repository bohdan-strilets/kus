// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { playSound } from '@/shared/lib'

import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from '../lib/live-draft.types'
import { useRestTimer } from './use-rest-timer'

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	playSound: vi.fn(),
}))

const T0 = new Date('2026-11-04T10:00:00.000Z').getTime()
const DEFAULT_REST_MS = 90_000
const MS_IN_SECOND = 1000

const iso = (offsetMs: number): string => new Date(T0 + offsetMs).toISOString()

const set = (doneAt: string | null): LiveDraftSet => ({
	rowKey: 'set-key',
	isEdited: false,
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt,
})

const exercise = (key: string, sets: LiveDraftSet[]): LiveDraftExercise => ({
	rowKey: key,
	clientKey: key,
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: key,
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets,
	plan: null,
})

const draft = (exercises: LiveDraftExercise[]): LiveDraft => ({
	workoutId: 'w',
	templateName: null,
	startedAt: null,
	exercises,
})

/** Bench: first set done at `doneAt`, two still to do. */
const afterFirstSet = (doneAt: string | null): LiveDraft =>
	draft([exercise('bench', [set(doneAt), set(null), set(null)])])

let visibility: DocumentVisibilityState = 'visible'

const setVisibility = (state: DocumentVisibilityState): void => {
	visibility = state
	document.dispatchEvent(new Event('visibilitychange'))
}

const advance = (ms: number): void => {
	act(() => {
		vi.advanceTimersByTime(ms)
	})
}

const renderTimer = (initial: LiveDraft) =>
	renderHook(({ value }: { value: LiveDraft }) => useRestTimer(value), {
		initialProps: { value: initial },
	})

beforeEach(() => {
	visibility = 'visible'
	vi.useFakeTimers()
	vi.setSystemTime(T0)
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.clearAllMocks()
})

describe('useRestTimer: the countdown', () => {
	it('nothing done: idle, no next-set text issues', () => {
		const { result } = renderTimer(afterFirstSet(null))

		expect(result.current.state.status).toBe('idle')
	})

	it('starts after the ✓ with the default rest', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		expect(result.current.state).toEqual({ status: 'running', remainingSec: 90, totalSec: 90 })
	})

	it('counts from the real doneAt: a set done 30 s ago has 60 s left', () => {
		const { result } = renderTimer(afterFirstSet(iso(-30_000)))

		expect(result.current.state).toMatchObject({ status: 'running', remainingSec: 60 })
	})

	it('ticks down and ends at the right moment', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		advance(DEFAULT_REST_MS - MS_IN_SECOND)
		expect(result.current.state).toMatchObject({ status: 'running', remainingSec: 1 })

		advance(MS_IN_SECOND)
		expect(result.current.state.status).toBe('ended')
	})

	it('no next set (last set of the last exercise): never shown, no sound', () => {
		const { result } = renderTimer(draft([exercise('bench', [set(iso(0))])]))

		advance(DEFAULT_REST_MS * 2)

		expect(result.current.state.status).toBe('idle')
		expect(result.current.next).toBeNull()
		expect(playSound).not.toHaveBeenCalled()
	})
})

describe('useRestTimer: the signal', () => {
	it('plays remind exactly once when the end comes while visible', () => {
		renderTimer(afterFirstSet(iso(0)))

		advance(DEFAULT_REST_MS)
		advance(10_000)

		expect(playSound).toHaveBeenCalledTimes(1)
		expect(playSound).toHaveBeenCalledWith('remind')
	})

	it('no sound while it is still running', () => {
		renderTimer(afterFirstSet(iso(0)))

		advance(DEFAULT_REST_MS - MS_IN_SECOND)

		expect(playSound).not.toHaveBeenCalled()
	})

	it('no sound if the end came while hidden, nor after coming back', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		act(() => {
			setVisibility('hidden')
		})
		advance(DEFAULT_REST_MS)
		expect(result.current.state.status).toBe('ended')
		act(() => {
			setVisibility('visible')
		})
		advance(5_000)

		expect(playSound).not.toHaveBeenCalled()
	})

	it('a frozen page (no ticks) that wakes up long after the end: ended, silent', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		act(() => {
			vi.setSystemTime(T0 + 10 * 60_000)
			setVisibility('visible')
		})

		expect(result.current.state.status).toBe('ended')
		expect(playSound).not.toHaveBeenCalled()
	})

	it('after the sound, a skip does not play it again', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))
		advance(DEFAULT_REST_MS)

		act(() => {
			result.current.skip()
		})
		advance(5_000)

		expect(playSound).toHaveBeenCalledTimes(1)
	})
})

describe('useRestTimer: extend and skip', () => {
	it('extend adds 15 s to the left time and the total, and stacks', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		act(() => {
			result.current.extend()
		})
		expect(result.current.state).toEqual({ status: 'running', remainingSec: 105, totalSec: 105 })

		act(() => {
			result.current.extend()
		})
		expect(result.current.state).toEqual({ status: 'running', remainingSec: 120, totalSec: 120 })
	})

	it('extended rest ends 15 s later and still signals once', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))
		act(() => {
			result.current.extend()
		})

		advance(DEFAULT_REST_MS)
		expect(result.current.state.status).toBe('running')
		expect(playSound).not.toHaveBeenCalled()

		advance(15_000)
		expect(result.current.state.status).toBe('ended')
		expect(playSound).toHaveBeenCalledTimes(1)
	})

	it('skip hides the timer', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		act(() => {
			result.current.skip()
		})

		expect(result.current.state.status).toBe('idle')
	})

	it('skip on an ended rest hides it too ("До підходу")', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))
		advance(DEFAULT_REST_MS)

		act(() => {
			result.current.skip()
		})

		expect(result.current.state.status).toBe('idle')
	})

	it('a new doneAt resets skip and extend', () => {
		const { result, rerender } = renderTimer(afterFirstSet(iso(0)))
		act(() => {
			result.current.extend()
			result.current.skip()
		})
		expect(result.current.state.status).toBe('idle')

		advance(20_000)
		rerender({
			value: draft([exercise('bench', [set(iso(0)), set(iso(20_000)), set(null)])]),
		})

		expect(result.current.state).toEqual({ status: 'running', remainingSec: 90, totalSec: 90 })
	})

	it('extend then skip: skip wins and the extension is not lost for the same doneAt', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		act(() => {
			result.current.extend()
		})
		act(() => {
			result.current.skip()
		})

		expect(result.current.state.status).toBe('idle')
	})
})

describe('useRestTimer: what comes next', () => {
	it('the same exercise: the number of the next working set, not another exercise', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		expect(result.current.next).toMatchObject({ setNumber: 2, isOtherExercise: false })
		expect(result.current.next?.exercise.name).toBe('bench')
	})

	it('another exercise: isOtherExercise, the number inside that exercise', () => {
		const { result } = renderTimer(
			draft([exercise('bench', [set(iso(0))]), exercise('squat', [set(null), set(null)])]),
		)

		expect(result.current.next).toMatchObject({ setNumber: 1, isOtherExercise: true })
		expect(result.current.next?.exercise.name).toBe('squat')
	})

	it('a done warm-up before the first working set does not shift the numbering', () => {
		const warmup: LiveDraftSet = { ...set(iso(0)), isWarmup: true }
		const { result } = renderTimer(draft([exercise('bench', [warmup, set(null)])]))

		expect(result.current.next?.setNumber).toBe(1)
	})
})

describe('useRestTimer: warm-up and cardio', () => {
	it('a warm-up as the next set is marked isWarmup', () => {
		const warmup: LiveDraftSet = { ...set(null), isWarmup: true }
		const { result } = renderTimer(
			draft([exercise('bench', [set(iso(0))]), exercise('squat', [warmup])]),
		)

		expect(result.current.next).toMatchObject({ isWarmup: true, isOtherExercise: true })
	})

	it('a working set is not marked isWarmup', () => {
		const { result } = renderTimer(afterFirstSet(iso(0)))

		expect(result.current.next?.isWarmup).toBe(false)
	})

	it('a begun cardio after the strength: idle, never ends, no sound', () => {
		const cardio: LiveDraftExercise = {
			...exercise('run', []),
			kind: 'CARDIO',
			muscleGroup: null,
			durationMin: 20,
		}
		const { result } = renderTimer(draft([exercise('bench', [set(iso(0)), set(null)]), cardio]))

		expect(result.current.state.status).toBe('idle')
		advance(DEFAULT_REST_MS * 2)

		expect(result.current.state.status).toBe('idle')
		expect(playSound).not.toHaveBeenCalled()
	})

	it('a cardio without data does not stop the rest', () => {
		const cardio: LiveDraftExercise = { ...exercise('run', []), kind: 'CARDIO', muscleGroup: null }
		const { result } = renderTimer(draft([exercise('bench', [set(iso(0)), set(null)]), cardio]))

		expect(result.current.state.status).toBe('running')
	})
})

describe('useRestTimer: the set in hand and cardio', () => {
	const cardio = (): LiveDraftExercise => ({
		...exercise('run', []),
		kind: 'CARDIO',
		muscleGroup: null,
	})
	const twoExercises = (): LiveDraft =>
		draft([exercise('bench', [set(iso(0)), set(null)]), exercise('legs', [set(null)])])

	it('«Далі» is the set in hand when it is still to do', () => {
		const value = twoExercises()
		const { result } = renderHook(() => useRestTimer(value, { exerciseIndex: 1, setIndex: 0 }))

		expect(result.current.next?.exercise.name).toBe('legs')
	})

	it('a hand on a done set falls back to the first set ahead', () => {
		const value = twoExercises()
		const { result } = renderHook(() => useRestTimer(value, { exerciseIndex: 0, setIndex: 0 }))

		expect(result.current.next?.exercise.name).toBe('bench')
	})

	it('no rest starts when only an unstarted cardio is left', () => {
		const value = draft([exercise('bench', [set(iso(0))]), cardio()])
		const { result } = renderHook(() => useRestTimer(value, { exerciseIndex: 1, setIndex: 0 }))

		expect(result.current.state.status).toBe('idle')
		expect(result.current.next).toBeNull()
	})
})
