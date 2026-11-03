import type { LiveWorkoutResponse, LiveWorkoutUpdate } from '@kus/shared'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LiveWorkoutConflictError } from '@/entities/workout'
import {
	LIVE_EDITED_AT,
	LIVE_WORKOUT_ID,
	makeExercise,
	makeLiveInput,
	makeLiveResponse,
} from '@/shared/testing'

import {
	CONFLICT_RETRIES_MAX,
	createLiveSync,
	type LiveSyncOptions,
	type LiveSyncState,
	RETRY_BASE_MS,
	RETRY_MAX_MS,
} from './create-live-sync'
import type { UnsentSnapshot } from './live-workout-store'

const EDITED_2 = '2026-11-02T10:05:00.000Z'
const EDITED_3 = '2026-11-02T10:10:00.000Z'

const config = {} as InternalAxiosRequestConfig

const networkError = (): AxiosError =>
	new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)

const httpError = (status: number, errorCode = 'SOME_ERROR'): AxiosError => {
	const response = {
		status,
		data: { statusCode: status, errorCode, details: {} },
		statusText: String(status),
		headers: {},
		config,
	} satisfies AxiosResponse
	return new AxiosError('failed', AxiosError.ERR_BAD_RESPONSE, config, null, response)
}

const editedConflict = (): LiveWorkoutConflictError =>
	new LiveWorkoutConflictError('EDITED', httpError(409))

const live = (editedAt: string | null): LiveWorkoutResponse => makeLiveResponse({ editedAt })

const exA = [makeLiveInput({ name: 'Вправа А' })]
const exB = [makeLiveInput({ name: 'Вправа Б' })]
const exC = [makeLiveInput({ name: 'Вправа В' })]

interface Deferred<T> {
	promise: Promise<T>
	resolve: (value: T) => void
}

const defer = <T>(): Deferred<T> => {
	let resolve: (value: T) => void = () => undefined
	const promise = new Promise<T>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

/** A store that remembers every write, so the order of «saved» and «sent» can be checked. */
const makeStore = (initial: UnsentSnapshot | null = null) => {
	const events: string[] = []
	let value = initial
	return {
		events,
		get value() {
			return value
		},
		store: {
			read: () => value,
			save: (snapshot: UnsentSnapshot) => {
				value = snapshot
				events.push('save')
				return true
			},
			clear: () => {
				value = null
				events.push('clear')
			},
		},
	}
}

interface Harness {
	options: LiveSyncOptions
	memory: ReturnType<typeof makeStore>
	put: ReturnType<typeof vi.fn<(update: LiveWorkoutUpdate) => Promise<LiveWorkoutResponse>>>
	refetchCurrent: ReturnType<typeof vi.fn<() => Promise<LiveWorkoutResponse | null>>>
	onSynced: ReturnType<typeof vi.fn<(live: LiveWorkoutResponse) => void>>
	onClosed: ReturnType<typeof vi.fn<() => void>>
	states: LiveSyncState[]
}

const setup = ({
	stored = null,
	initialEditedAt = LIVE_EDITED_AT,
}: {
	stored?: UnsentSnapshot | null
	initialEditedAt?: string | null
} = {}): Harness => {
	const memory = makeStore(stored)
	const states: LiveSyncState[] = []
	const put = vi.fn<(update: LiveWorkoutUpdate) => Promise<LiveWorkoutResponse>>()
	const refetchCurrent = vi.fn<() => Promise<LiveWorkoutResponse | null>>()
	const onSynced = vi.fn<(live: LiveWorkoutResponse) => void>()
	const onClosed = vi.fn<() => void>()
	const options: LiveSyncOptions = {
		workoutId: LIVE_WORKOUT_ID,
		initialEditedAt,
		store: memory.store,
		put,
		refetchCurrent,
		onSynced,
		onClosed,
		onChange: (state) => states.push(state),
	}
	return { options, memory, put, refetchCurrent, onSynced, onClosed, states }
}

const lastStatus = (harness: Harness): string | undefined => harness.states.at(-1)?.status

/** Lets the promise chain of the engine run without moving the fake clock. */
const settle = async (): Promise<void> => {
	await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('createLiveSync: sending', () => {
	it('stores the snapshot before the request goes out and clears it after the answer', async () => {
		const h = setup()
		const order: string[] = []
		h.put.mockImplementation(() => {
			order.push(`put after ${h.memory.events.join(',')}`)
			return Promise.resolve(live(EDITED_2))
		})
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		expect(h.memory.value).toEqual({ exercises: exA, knownEditedAt: LIVE_EDITED_AT })
		await settle()

		expect(order).toEqual(['put after save'])
		expect(h.put).toHaveBeenCalledWith({ knownEditedAt: LIVE_EDITED_AT, exercises: exA })
		expect(h.memory.value).toBeNull()
		expect(h.onSynced).toHaveBeenCalledTimes(1)
		expect(lastStatus(h)).toBe('idle')
	})

	it('keeps one request in flight and sends the newest snapshot after it (coalescing)', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValueOnce(first.promise).mockResolvedValue(live(EDITED_3))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		sync.schedule(exB)
		sync.schedule(exC)
		await settle()
		expect(h.put).toHaveBeenCalledTimes(1)

		first.resolve(live(EDITED_2))
		await settle()

		expect(h.put).toHaveBeenCalledTimes(2)
		// the intermediate snapshot is skipped; the next request carries the newest editedAt
		expect(h.put.mock.calls[1]?.[0]).toEqual({ knownEditedAt: EDITED_2, exercises: exC })
		expect(h.memory.value).toBeNull()
	})

	it('does not clear the store while a newer snapshot waits', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValueOnce(first.promise).mockReturnValue(new Promise(() => undefined))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		sync.schedule(exB)
		first.resolve(live(EDITED_2))
		await settle()

		expect(h.memory.value?.exercises).toEqual(exB)
		expect(h.memory.value?.knownEditedAt).toBe(EDITED_2)
	})

	it('sends a snapshot left by a killed PWA first, with the stored knownEditedAt', async () => {
		const stored: UnsentSnapshot = { exercises: exA, knownEditedAt: '2026-11-02T09:30:00.000Z' }
		const h = setup({ stored, initialEditedAt: EDITED_3 })
		h.put.mockResolvedValue(live(EDITED_2))

		createLiveSync(h.options)
		await settle()

		expect(h.put).toHaveBeenCalledTimes(1)
		expect(h.put).toHaveBeenCalledWith({
			knownEditedAt: '2026-11-02T09:30:00.000Z',
			exercises: exA,
		})
		expect(h.memory.value).toBeNull()
	})

	it('sends nothing at start when the store is empty', async () => {
		const h = setup()
		createLiveSync(h.options)
		await settle()

		expect(h.put).not.toHaveBeenCalled()
	})
})

describe('createLiveSync: failures', () => {
	it.each([
		['network', networkError, 'offline'],
		['5xx', () => httpError(503), 'error'],
	])(
		'retries a %s failure with a pause growing from 1 s to 30 s',
		async (_name, makeError, status) => {
			const h = setup()
			h.put.mockRejectedValue(makeError())
			const sync = createLiveSync(h.options)

			sync.schedule(exA)
			await settle()
			expect(h.put).toHaveBeenCalledTimes(1)
			expect(lastStatus(h)).toBe(status)

			const expectedDelays = [
				RETRY_BASE_MS,
				2_000,
				4_000,
				8_000,
				16_000,
				RETRY_MAX_MS,
				RETRY_MAX_MS,
			]
			for (const [index, delay] of expectedDelays.entries()) {
				await vi.advanceTimersByTimeAsync(delay - 1)
				expect(h.put).toHaveBeenCalledTimes(index + 1)
				await vi.advanceTimersByTimeAsync(1)
				expect(h.put).toHaveBeenCalledTimes(index + 2)
			}
			// the snapshot is still there: nothing was lost
			expect(h.memory.value?.exercises).toEqual(exA)
		},
	)

	it('goes back to idle and resets the pause after a success', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(networkError()).mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)

		expect(h.put).toHaveBeenCalledTimes(2)
		expect(lastStatus(h)).toBe('idle')
		expect(h.memory.value).toBeNull()

		h.put.mockRejectedValueOnce(networkError())
		sync.schedule(exB)
		await settle()
		await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)
		expect(h.put).toHaveBeenCalledTimes(4)
	})

	it('does not retry a 4xx by itself: status error, the snapshot is kept', async () => {
		const h = setup()
		h.put.mockRejectedValue(httpError(422, 'VALIDATION_ERROR'))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 3)

		expect(h.put).toHaveBeenCalledTimes(1)
		expect(lastStatus(h)).toBe('error')
		expect(h.memory.value?.exercises).toEqual(exA)
		expect(h.onClosed).not.toHaveBeenCalled()
	})

	it('sends again on retry() after a 4xx', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(httpError(400)).mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		sync.retry()
		await settle()

		expect(h.put).toHaveBeenCalledTimes(2)
		expect(lastStatus(h)).toBe('idle')
	})

	it('retry() (the online event) sends at once, without waiting for the pause', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(networkError()).mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		expect(lastStatus(h)).toBe('offline')

		sync.retry()
		await settle()

		expect(h.put).toHaveBeenCalledTimes(2)
		expect(lastStatus(h)).toBe('idle')
		// the pending timer must not send a third time
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS)
		expect(h.put).toHaveBeenCalledTimes(2)
	})

	it('retry() does nothing when there is nothing to send', async () => {
		const h = setup()
		const sync = createLiveSync(h.options)

		sync.retry()
		await settle()

		expect(h.put).not.toHaveBeenCalled()
	})

	it('a snapshot scheduled during the pause is sent with the next try (the newest wins)', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(networkError()).mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		sync.schedule(exB)
		await settle()
		// still waiting for the timer: one request only
		expect(h.put).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)

		expect(h.put).toHaveBeenCalledTimes(2)
		expect(h.put.mock.calls[1]?.[0].exercises).toEqual(exB)
	})

	it('stops all timers on dispose and keeps the snapshot for the next start', async () => {
		const h = setup()
		h.put.mockRejectedValue(networkError())
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		sync.dispose()
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS)

		expect(h.put).toHaveBeenCalledTimes(1)
		expect(h.memory.value?.exercises).toEqual(exA)
	})
})

describe('createLiveSync: the chat meanwhile', () => {
	it('409 EDITED: reads the session again and sends the local exercises with the new editedAt', async () => {
		const h = setup()
		const fresh = live(EDITED_2)
		h.put.mockRejectedValueOnce(editedConflict()).mockResolvedValue(live(EDITED_3))
		h.refetchCurrent.mockResolvedValue(fresh)
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()

		expect(h.refetchCurrent).toHaveBeenCalledTimes(1)
		expect(h.onSynced).toHaveBeenNthCalledWith(1, fresh)
		expect(h.put).toHaveBeenCalledTimes(2)
		expect(h.put.mock.calls[1]?.[0]).toEqual({ knownEditedAt: EDITED_2, exercises: exA })
		expect(h.onClosed).not.toHaveBeenCalled()
		expect(lastStatus(h)).toBe('idle')
	})

	describe('409 EDITED after the chat rewrote a live exercise in place (same clientKey)', () => {
		const BENCH_KEY = '0199b3a4-0000-7000-8000-0000000000d1'
		const SQUAT_KEY = '0199b3a4-0000-7000-8000-0000000000d2'
		const serverSet = (weightKg: number) => ({
			reps: 8,
			weightKg,
			durationSec: null,
			distanceM: null,
			isWarmup: false,
			doneAt: '2026-11-02T09:20:00.000Z',
		})
		const bench80 = makeLiveInput({
			clientKey: BENCH_KEY,
			sets: [{ ...serverSet(80), doneAt: null }],
		})
		const squat = makeLiveInput({ clientKey: SQUAT_KEY, name: 'Присід' })
		const freshWithBench85 = (editedAt: string): LiveWorkoutResponse =>
			makeLiveResponse({
				editedAt,
				workout: {
					...makeLiveResponse().workout,
					exercises: [makeExercise({ clientKey: BENCH_KEY, sets: [serverSet(85)] })],
				},
			})
		const weightsOf = (
			exercises: readonly { clientKey: string; sets: { weightKg: number | null }[] }[],
		) => exercises.map(({ clientKey, sets }) => [clientKey, sets.map(({ weightKg }) => weightKg)])

		it('the resend carries the server 85, not the old 80, and the unrelated unsent exercise, with the new knownEditedAt', async () => {
			const h = setup()
			h.put.mockRejectedValueOnce(editedConflict()).mockResolvedValue(live(EDITED_3))
			h.refetchCurrent.mockResolvedValue(freshWithBench85(EDITED_2))
			const sync = createLiveSync(h.options)

			sync.schedule([bench80, squat])
			await settle()

			expect(h.put).toHaveBeenCalledTimes(2)
			const resent = h.put.mock.calls[1]?.[0]
			expect(resent?.knownEditedAt).toBe(EDITED_2)
			expect(weightsOf(resent?.exercises ?? [])).toEqual([
				[BENCH_KEY, [85]],
				[SQUAT_KEY, [50]],
			])
			expect(lastStatus(h)).toBe('idle')
		})

		it('the persisted snapshot has no old 80 between the re-read and the second send (no resurrection)', async () => {
			const h = setup()
			h.put.mockRejectedValueOnce(editedConflict()).mockReturnValue(new Promise(() => undefined))
			h.refetchCurrent.mockResolvedValue(freshWithBench85(EDITED_2))
			const sync = createLiveSync(h.options)

			sync.schedule([bench80, squat])
			await settle()

			expect(h.memory.value?.knownEditedAt).toBe(EDITED_2)
			const weights = weightsOf(h.memory.value?.exercises ?? [])
			expect(weights).toEqual([
				[BENCH_KEY, [85]],
				[SQUAT_KEY, [50]],
			])
			expect(JSON.stringify(h.memory.value)).not.toContain('"weightKg":80')
		})

		it('a snapshot kept after the conflict limit is merged too, so «повторити» does not bring 80 back', async () => {
			const h = setup()
			h.put.mockImplementation(() => Promise.reject(editedConflict()))
			h.refetchCurrent.mockResolvedValue(freshWithBench85(EDITED_2))
			const sync = createLiveSync(h.options)

			sync.schedule([bench80])
			await settle()

			expect(lastStatus(h)).toBe('error')
			expect(weightsOf(h.memory.value?.exercises ?? [])).toEqual([[BENCH_KEY, [85]]])
		})

		it('adds a live exercise only the server has, so the resend does not delete it', async () => {
			const h = setup()
			h.put.mockRejectedValueOnce(editedConflict()).mockResolvedValue(live(EDITED_3))
			h.refetchCurrent.mockResolvedValue(freshWithBench85(EDITED_2))
			const sync = createLiveSync(h.options)

			sync.schedule([squat])
			await settle()

			expect(weightsOf(h.put.mock.calls[1]?.[0].exercises ?? [])).toEqual([
				[SQUAT_KEY, [50]],
				[BENCH_KEY, [85]],
			])
		})
	})

	it('stores the new knownEditedAt between the re-read and the second send', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(editedConflict()).mockReturnValue(new Promise(() => undefined))
		h.refetchCurrent.mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()

		expect(h.memory.value).toEqual({ exercises: exA, knownEditedAt: EDITED_2 })
	})

	it('stops with status error after more than three EDITED in a row', async () => {
		const h = setup()
		h.put.mockImplementation(() => Promise.reject(editedConflict()))
		h.refetchCurrent.mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2)

		// the last conflict is read again too: the next send needs the newest editedAt
		expect(h.refetchCurrent).toHaveBeenCalledTimes(CONFLICT_RETRIES_MAX + 1)
		expect(h.put).toHaveBeenCalledTimes(CONFLICT_RETRIES_MAX + 1)
		expect(h.onSynced).toHaveBeenCalledTimes(CONFLICT_RETRIES_MAX + 1)
		expect(lastStatus(h)).toBe('error')
		expect(h.memory.value).toEqual({ exercises: exA, knownEditedAt: EDITED_2 })
		expect(h.onClosed).not.toHaveBeenCalled()
	})

	it('after the error the count starts over: «повторити» tries the full number again', async () => {
		const h = setup()
		h.put.mockImplementation(() => Promise.reject(editedConflict()))
		h.refetchCurrent.mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()
		expect(lastStatus(h)).toBe('error')
		h.put.mockClear()

		sync.retry()
		await settle()

		expect(h.put).toHaveBeenCalledTimes(CONFLICT_RETRIES_MAX + 1)
		expect(h.put.mock.calls[0]?.[0].knownEditedAt).toBe(EDITED_2)
	})

	it('a success resets the count of consecutive EDITED', async () => {
		const h = setup()
		const edited = () => Promise.reject(editedConflict())
		h.put
			.mockImplementationOnce(edited)
			.mockImplementationOnce(edited)
			.mockResolvedValueOnce(live(EDITED_2))
			.mockImplementationOnce(edited)
			.mockImplementationOnce(edited)
			.mockResolvedValue(live(EDITED_3))
		h.refetchCurrent.mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		sync.schedule(exB)
		await settle()

		expect(lastStatus(h)).toBe('idle')
		expect(h.put).toHaveBeenCalledTimes(6)
	})

	it.each([
		['409 FINISHED', () => new LiveWorkoutConflictError('FINISHED', httpError(409))],
		['404', () => httpError(404, 'WORKOUT_NOT_FOUND')],
	])('%s: closedByChat, snapshot cleared, no more requests', async (_name, makeError) => {
		const h = setup()
		h.put.mockRejectedValue(makeError())
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()

		expect(h.onClosed).toHaveBeenCalledTimes(1)
		expect(h.memory.value).toBeNull()
		expect(h.states.at(-1)).toEqual({ status: 'idle', closedByChat: true })

		sync.schedule(exB)
		sync.retry()
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2)

		expect(h.put).toHaveBeenCalledTimes(1)
		expect(h.memory.value).toBeNull()
	})

	it('409 EDITED with the session gone (null) closes it', async () => {
		const h = setup()
		h.put.mockRejectedValue(editedConflict())
		h.refetchCurrent.mockResolvedValue(null)
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()

		expect(h.onClosed).toHaveBeenCalledTimes(1)
		expect(h.states.at(-1)?.closedByChat).toBe(true)
		expect(h.memory.value).toBeNull()
		expect(h.put).toHaveBeenCalledTimes(1)
	})

	it('409 EDITED with another open session closes this one', async () => {
		const h = setup()
		h.put.mockRejectedValue(editedConflict())
		const other = live(EDITED_2)
		h.refetchCurrent.mockResolvedValue({
			...other,
			workout: { ...other.workout, id: '0199b3a4-0000-7000-8000-0000000000ff' },
		})
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()

		expect(h.onClosed).toHaveBeenCalledTimes(1)
		expect(h.onSynced).not.toHaveBeenCalled()
	})

	it('keeps the snapshot and retries when the re-read after a 409 fails on the network', async () => {
		const h = setup()
		h.put.mockRejectedValueOnce(editedConflict()).mockResolvedValue(live(EDITED_3))
		h.refetchCurrent.mockRejectedValueOnce(networkError()).mockResolvedValue(live(EDITED_2))
		const sync = createLiveSync(h.options)

		sync.schedule(exA)
		await settle()
		expect(lastStatus(h)).toBe('offline')
		expect(h.memory.value?.exercises).toEqual(exA)

		await vi.advanceTimersByTimeAsync(RETRY_BASE_MS)

		expect(lastStatus(h)).toBe('idle')
		expect(h.memory.value).toBeNull()
	})
})

describe('createLiveSync: whenIdle', () => {
	it('resolves idle at once when nothing is going on', async () => {
		const h = setup()
		const sync = createLiveSync(h.options)

		await expect(sync.whenIdle()).resolves.toBe('idle')
	})

	it('waits for the request in flight and the snapshot behind it', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValueOnce(first.promise).mockResolvedValue(live(EDITED_3))
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()
		sync.schedule(exB)
		const onIdle = vi.fn()
		void sync.whenIdle().then(onIdle)

		await settle()
		expect(onIdle).not.toHaveBeenCalled()

		first.resolve(live(EDITED_2))
		await settle()

		expect(onIdle).toHaveBeenCalledWith('idle')
		expect(h.put).toHaveBeenCalledTimes(2)
		expect(h.memory.value).toBeNull()
	})

	it('returns offline at once when the sets are stuck on the network', async () => {
		const h = setup()
		h.put.mockRejectedValue(networkError())
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()

		await expect(sync.whenIdle()).resolves.toBe('offline')
	})

	it('returns error at once after a 4xx', async () => {
		const h = setup()
		h.put.mockRejectedValue(httpError(422))
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()

		await expect(sync.whenIdle()).resolves.toBe('error')
	})

	it('a waiter during a failing request gets the stuck status, not a hang', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValue(first.promise)
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()
		const onIdle = vi.fn()
		void sync.whenIdle().then(onIdle)

		first.promise.catch(() => undefined)
		h.put.mockRejectedValue(networkError())
		first.resolve(live(EDITED_2))
		await settle()

		expect(onIdle).toHaveBeenCalledWith('idle')
	})
})

describe('createLiveSync: a disposed engine writes nothing', () => {
	it('schedule after dispose neither stores nor sends', async () => {
		const h = setup()
		const sync = createLiveSync(h.options)
		sync.dispose()

		sync.schedule(exA)
		await settle()

		expect(h.put).not.toHaveBeenCalled()
		expect(h.memory.events).toEqual([])
	})

	it('the answer of a request that was in flight at dispose touches neither cache nor store', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValue(first.promise)
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()
		const eventsBefore = [...h.memory.events]

		sync.dispose()
		first.resolve(live(EDITED_2))
		await settle()

		expect(h.onSynced).not.toHaveBeenCalled()
		expect(h.memory.events).toEqual(eventsBefore)
		expect(h.memory.value?.exercises).toEqual(exA)
	})

	it('a failure that arrives after dispose starts no retry and writes nothing', async () => {
		const h = setup()
		const first = defer<LiveWorkoutResponse>()
		h.put.mockReturnValue(first.promise)
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()
		sync.dispose()
		h.put.mockRejectedValue(networkError())

		// reject the first request after dispose
		first.promise.catch(() => undefined)
		h.put.mockClear()
		await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 2)

		expect(h.put).not.toHaveBeenCalled()
	})

	it('a 409 FINISHED / 404 answer after dispose does not close caches or clear the store', async () => {
		const h = setup()
		const failing = new Promise<LiveWorkoutResponse>((_resolve, reject) => {
			setTimeout(() => {
				reject(new LiveWorkoutConflictError('FINISHED', httpError(409)))
			}, 100)
		})
		h.put.mockReturnValue(failing)
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()

		sync.dispose()
		await vi.advanceTimersByTimeAsync(200)

		expect(h.onClosed).not.toHaveBeenCalled()
		expect(h.memory.value?.exercises).toEqual(exA)
	})

	it('a re-read after a 409 that returns after dispose is not adopted', async () => {
		const h = setup()
		const reread = defer<LiveWorkoutResponse | null>()
		h.put.mockRejectedValue(editedConflict())
		h.refetchCurrent.mockReturnValue(reread.promise)
		const sync = createLiveSync(h.options)
		sync.schedule(exA)
		await settle()

		sync.dispose()
		reread.resolve(live(EDITED_2))
		await settle()

		expect(h.onSynced).not.toHaveBeenCalled()
		expect(h.put).toHaveBeenCalledTimes(1)
	})

	it('a stale engine does not wipe the snapshot of a newer instance of the same session', async () => {
		const shared = makeStore()
		const first = setup()
		const second = setup()
		const stale = defer<LiveWorkoutResponse>()
		first.options.store = shared.store
		second.options.store = shared.store
		first.put.mockReturnValue(stale.promise)
		second.put.mockReturnValue(new Promise(() => undefined))

		const oldEngine = createLiveSync(first.options)
		oldEngine.schedule(exA)
		await settle()
		oldEngine.dispose()
		// the screen opened again: a new engine holds a newer snapshot of the same workout
		const newEngine = createLiveSync(second.options)
		newEngine.schedule(exB)
		await settle()

		stale.resolve(live(EDITED_2))
		await settle()

		expect(shared.value?.exercises).toEqual(exB)
		expect(shared.events.at(-1)).toBe('save')
	})
})
