import type { LivePlanExercise } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { NEW_CARDIO_MIN } from '@/entities/workout'

import {
	LIVE_EDITED_AT,
	LIVE_STARTED_AT,
	makeExercise,
	makeLiveInput,
	makeLiveResponse,
	makePlanExercise,
} from '@/shared/testing'

import {
	adoptServerExercises,
	buildLiveDraft,
	toLiveExerciseInputs,
	toLiveUpdate,
} from './build-live-draft'
import { formatElapsed } from './format-elapsed'
import type { LiveDraft, LiveDraftExercise, LiveDraftSet } from './live-draft.types'
import {
	addSet,
	addWarmup,
	countDoneSets,
	createLiveExercise,
	getWeightStepKg,
	getWorkingNumber,
	isBodyweightExercise,
	isExerciseDone,
	patchSet,
	setCardioMinutes,
	setSetDone,
} from './live-draft-edit'
import { applyProgressHint, getCurrentSet, getElapsedMinutes, getNextSet } from './live-set-helpers'

const KEY_1 = '0199b3a4-0000-7000-8000-0000000000d1'
const KEY_2 = '0199b3a4-0000-7000-8000-0000000000d2'
const KEY_3 = '0199b3a4-0000-7000-8000-0000000000d3'
const DONE_AT = '2026-11-02T09:20:00.000Z'

const makeKeys = (): (() => string) => {
	const keys = [KEY_1, KEY_2, KEY_3]
	let index = 0
	return () => keys[index++] ?? `0199b3a4-0000-7000-8000-00000000ff${index}`
}

const set = (overrides: Partial<LiveDraftSet> = {}): LiveDraftSet => ({
	reps: 8,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	doneAt: null,
	...overrides,
})

const exercise = (overrides: Partial<LiveDraftExercise> = {}): LiveDraftExercise => ({
	rowKey: KEY_1,
	clientKey: KEY_1,
	readOnly: false,
	exerciseId: null,
	templateExerciseId: null,
	name: 'Жим лежачи',
	kind: 'STRENGTH',
	muscleGroup: 'CHEST',
	isBodyweight: null,
	durationMin: null,
	distanceM: null,
	sets: [set(), set(), set()],
	plan: null,
	...overrides,
})

const draftOf = (...exercises: LiveDraftExercise[]): LiveDraft => ({
	workoutId: 'w1',
	templateName: null,
	startedAt: LIVE_STARTED_AT,
	exercises,
})

const planDraft = (overrides: Partial<LivePlanExercise> = {}) =>
	buildLiveDraft(makeLiveResponse({ plan: [makePlanExercise(overrides)] }), {
		createKey: makeKeys(),
	}).exercises[0] as LiveDraftExercise

describe('buildLiveDraft', () => {
	it('builds the sets of the plan: count, top of the rep range, plan weight', () => {
		const built = planDraft()

		expect(built.clientKey).toBe(KEY_1)
		expect(built.sets).toHaveLength(3)
		expect(built.sets.every((s) => s.reps === 10 && s.weightKg === 50 && s.doneAt === null)).toBe(
			true,
		)
		expect(built.plan?.restSec).toBe(90)
		expect(built.readOnly).toBe(false)
	})

	it('takes the weight from the last time when the plan has none', () => {
		const built = planDraft({
			weightKg: null,
			lastSets: [
				{ reps: 12, weightKg: 20, isWarmup: true },
				{ reps: 8, weightKg: 55, isWarmup: false },
			],
		})

		expect(built.sets.map((s) => s.weightKg)).toEqual([55, 55, 55])
	})

	it('falls back to one empty row for a plan without a set count', () => {
		const built = planDraft({ sets: null, repsMin: null, repsMax: null, weightKg: null })

		expect(built.sets).toEqual([set({ reps: null, weightKg: null })])
	})

	it('a planned cardio starts NOT done: no minutes, no distance, no sets; the plan minutes are only the start', () => {
		const built = planDraft({
			kind: 'CARDIO',
			sets: null,
			durationMin: 20,
			distanceM: 3000,
			muscleGroup: null,
		})

		expect(built.sets).toEqual([])
		expect(built.durationMin).toBeNull()
		expect(built.distanceM).toBeNull()
		expect(built.plan?.durationMin).toBe(20)
		expect(isExerciseDone(built)).toBe(false)
	})

	it('a planned cardio is not in the PUT until its minutes are set (even if the plan names a distance)', () => {
		const built = planDraft({
			kind: 'CARDIO',
			sets: null,
			durationMin: 20,
			distanceM: 3000,
			muscleGroup: null,
		})
		const draft = { workoutId: 'w', templateName: null, startedAt: null, exercises: [built] }

		expect(toLiveExerciseInputs(draft)).toEqual([])

		const withMinutes = setCardioMinutes(draft, 0, 20)

		expect(toLiveExerciseInputs(withMinutes).map((input) => input.durationMin)).toEqual([20])
		expect(isExerciseDone(withMinutes.exercises[0] as LiveDraftExercise)).toBe(true)
	})

	it('a cardio the server already holds keeps its minutes', () => {
		const plan = makePlanExercise({
			kind: 'CARDIO',
			sets: null,
			durationMin: 20,
			muscleGroup: null,
		})
		const saved = makeExercise({
			clientKey: KEY_2,
			templateExerciseId: plan.templateExerciseId,
			kind: 'CARDIO',
			muscleGroup: null,
			durationMin: 25,
			sets: [],
		})
		const built = buildLiveDraft(
			makeLiveResponse({
				plan: [plan],
				workout: { ...makeLiveResponse().workout, exercises: [saved] },
			}),
		)

		expect(built.exercises[0]?.durationMin).toBe(25)
		expect(built.exercises[0]?.plan?.durationMin).toBe(20)
	})

	it('gives a bodyweight plan exercise no weight, and leaves isBodyweight to the person', () => {
		const built = planDraft({ isBodyweight: true })

		expect(built.sets.every((s) => s.weightKg === null)).toBe(true)
		expect(built.isBodyweight).toBeNull()
		expect(built.plan?.isBodyweight).toBe(true)
		expect(isBodyweightExercise(built)).toBe(true)
	})

	it('keeps what the server holds for a plan exercise (matched by templateExerciseId)', () => {
		const plan = makePlanExercise()
		const saved = makeExercise({
			clientKey: KEY_2,
			templateExerciseId: plan.templateExerciseId,
			sets: [
				{
					reps: 9,
					weightKg: 52.5,
					durationSec: null,
					distanceM: null,
					isWarmup: false,
					doneAt: DONE_AT,
				},
			],
		})
		const built = buildLiveDraft(
			makeLiveResponse({
				plan: [plan],
				workout: { ...makeLiveResponse().workout, exercises: [saved] },
			}),
			{ createKey: makeKeys() },
		)

		expect(built.exercises).toHaveLength(1)
		expect(built.exercises[0]?.clientKey).toBe(KEY_2)
		expect(built.exercises[0]?.sets).toHaveLength(1)
		expect(built.exercises[0]?.sets[0]?.doneAt).toBe(DONE_AT)
		expect(built.exercises[0]?.plan?.sets).toBe(3)
	})

	it('puts free live exercises after the plan and chat exercises last, as read only', () => {
		const plan = makePlanExercise()
		const free = makeExercise({ id: 'free', clientKey: KEY_2, name: 'Підтягування' })
		const chat = makeExercise({ id: 'chat-1', clientKey: null, name: 'Присід' })
		const built = buildLiveDraft(
			makeLiveResponse({
				plan: [plan],
				workout: { ...makeLiveResponse().workout, exercises: [chat, free] },
			}),
			{ createKey: makeKeys() },
		)

		expect(built.exercises.map((e) => e.name)).toEqual(['Жим лежачи', 'Підтягування', 'Присід'])
		expect(built.exercises.map((e) => e.readOnly)).toEqual([false, false, true])
		expect(built.exercises[2]?.clientKey).toBeNull()
		expect(built.exercises[2]?.rowKey).toBe('chat-1')
	})

	it('starts from the unsent snapshot instead of the server copy of the live exercises', () => {
		const plan = makePlanExercise()
		const saved = makeExercise({
			clientKey: KEY_2,
			templateExerciseId: plan.templateExerciseId,
			sets: [],
		})
		const unsent = makeLiveInput({
			clientKey: KEY_2,
			templateExerciseId: plan.templateExerciseId,
			sets: [
				{
					reps: 10,
					weightKg: 60,
					durationSec: null,
					distanceM: null,
					isWarmup: false,
					doneAt: DONE_AT,
				},
			],
		})
		const built = buildLiveDraft(
			makeLiveResponse({
				plan: [plan],
				workout: { ...makeLiveResponse().workout, exercises: [saved] },
			}),
			{ unsent: [unsent], createKey: makeKeys() },
		)

		expect(built.exercises[0]?.sets).toEqual([set({ reps: 10, weightKg: 60, doneAt: DONE_AT })])
	})

	it('an empty unsent snapshot is the truth too (everything was removed)', () => {
		const saved = makeExercise({ clientKey: KEY_2 })
		const built = buildLiveDraft(
			makeLiveResponse({ workout: { ...makeLiveResponse().workout, exercises: [saved] } }),
			{ unsent: [] },
		)

		expect(built.exercises).toEqual([])
	})

	it('copies the session header', () => {
		const built = buildLiveDraft(makeLiveResponse({ templateName: 'Верх А' }))

		expect(built).toMatchObject({ templateName: 'Верх А', startedAt: LIVE_STARTED_AT })
	})
})

describe('adoptServerExercises', () => {
	const serverSet = (weightKg: number, doneAt: string | null = DONE_AT) => ({
		reps: 5,
		weightKg,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt,
	})
	const liveOf = (...exercises: ReturnType<typeof makeExercise>[]) =>
		makeLiveResponse({ workout: { ...makeLiveResponse().workout, exercises } })

	it('for a shared clientKey the server wins: the chat edited it in place, the old 80 does not come back', () => {
		const mine = exercise({
			rowKey: 'row-1',
			exerciseId: 'dict-1',
			plan: planDraft().plan,
			sets: [set({ weightKg: 80, doneAt: DONE_AT })],
		})
		const laterAt = '2026-11-02T09:30:00.000Z'
		const server = makeExercise({
			clientKey: KEY_1,
			name: 'Жим 85',
			kind: 'CARDIO',
			muscleGroup: null,
			isBodyweight: true,
			durationMin: 12,
			distanceM: 2000,
			templateExerciseId: KEY_3,
			sets: [serverSet(85), serverSet(85, laterAt)],
		})

		const adopted = adoptServerExercises(draftOf(mine), liveOf(server))

		expect(adopted.exercises).toHaveLength(1)
		expect(adopted.exercises[0]).toMatchObject({
			name: 'Жим 85',
			kind: 'CARDIO',
			muscleGroup: null,
			isBodyweight: true,
			durationMin: 12,
			distanceM: 2000,
			templateExerciseId: KEY_3,
			sets: [serverSet(85), serverSet(85, laterAt)],
		})
		// what is the screen's own stays
		expect(adopted.exercises[0]).toMatchObject({
			rowKey: 'row-1',
			exerciseId: 'dict-1',
			plan: mine.plan,
			readOnly: false,
			clientKey: KEY_1,
		})
	})

	it('keeps local exercises the server does not know (not sent yet) and does not duplicate the shared one', () => {
		const shared = exercise({ sets: [set({ weightKg: 80 })] })
		const unsent = exercise({ rowKey: KEY_2, clientKey: KEY_2, name: 'Присід' })

		const adopted = adoptServerExercises(
			draftOf(shared, unsent),
			liveOf(makeExercise({ clientKey: KEY_1, sets: [serverSet(85)] })),
		)

		expect(adopted.exercises.map((e) => e.clientKey)).toEqual([KEY_1, KEY_2])
		expect(adopted.exercises[1]).toBe(unsent)
		expect(toLiveExerciseInputs(adopted).map((input) => input.clientKey)).toEqual([KEY_1, KEY_2])
	})

	it('adds a live exercise only the server has, editable', () => {
		const adopted = adoptServerExercises(
			draftOf(exercise()),
			liveOf(
				makeExercise({ id: 'a', clientKey: KEY_1 }),
				makeExercise({ id: 'b', clientKey: KEY_3, name: 'Тяга' }),
			),
		)

		expect(adopted.exercises.map((e) => [e.name, e.readOnly])).toEqual([
			['Жим лежачи', false],
			['Тяга', false],
		])
		expect(adopted.exercises[1]?.rowKey).toBe(KEY_3)
	})

	it('replaces the read-only chat exercises with the ones the server has now (no key), after the live ones', () => {
		const mine = exercise({ sets: [set({ doneAt: DONE_AT })] })
		const oldChat = exercise({ rowKey: 'old', clientKey: null, readOnly: true, name: 'Старе' })
		const newChat = makeExercise({ id: 'new-chat', clientKey: null, name: 'Нове з чату' })

		const adopted = adoptServerExercises(
			draftOf(mine, oldChat),
			liveOf(makeExercise({ clientKey: KEY_1 }), newChat),
		)

		expect(adopted.exercises.map((e) => e.name)).toEqual(['Жим лежачи', 'Нове з чату'])
		expect(adopted.exercises[1]).toMatchObject({
			readOnly: true,
			clientKey: null,
			rowKey: 'new-chat',
		})
		expect(toLiveExerciseInputs(adopted).map((input) => input.clientKey)).toEqual([KEY_1])
	})

	it('a local exercise stays when the server has no exercises at all', () => {
		const mine = exercise()

		const adopted = adoptServerExercises(draftOf(mine), makeLiveResponse())

		expect(adopted.exercises).toEqual([mine])
	})

	it('drops the chat exercises the chat removed', () => {
		const oldChat = exercise({ rowKey: 'old', clientKey: null, readOnly: true })

		const adopted = adoptServerExercises(draftOf(oldChat), makeLiveResponse())

		expect(adopted.exercises).toEqual([])
	})
})

describe('toLiveExerciseInputs / toLiveUpdate', () => {
	it('never sends a chat exercise (clientKey null, readOnly)', () => {
		const chat = exercise({ rowKey: 'c', clientKey: null, readOnly: true })

		expect(toLiveExerciseInputs(draftOf(exercise(), chat))).toHaveLength(1)
		expect(toLiveExerciseInputs(draftOf(chat))).toEqual([])
	})

	it('does not send an exercise without content', () => {
		const empty = exercise({ rowKey: KEY_2, clientKey: KEY_2, sets: [] })
		const cardio = exercise({
			rowKey: KEY_3,
			clientKey: KEY_3,
			kind: 'CARDIO',
			sets: [],
			durationMin: 15,
		})

		const inputs = toLiveExerciseInputs(draftOf(empty, cardio))

		expect(inputs.map((i) => i.clientKey)).toEqual([KEY_3])
		expect(inputs[0]?.durationMin).toBe(15)
	})

	it('sends cardio with only a distance', () => {
		const cardio = exercise({ kind: 'CARDIO', sets: [], distanceM: 3000 })

		expect(toLiveExerciseInputs(draftOf(cardio))).toHaveLength(1)
	})

	it('sends weightKg null for a bodyweight exercise on every set', () => {
		const pullups = exercise({
			isBodyweight: true,
			sets: [set({ weightKg: 10 }), set({ weightKg: 0 })],
		})

		const [input] = toLiveExerciseInputs(draftOf(pullups))

		expect(input?.sets.map((s) => s.weightKg)).toEqual([null, null])
		expect(input?.isBodyweight).toBe(true)
	})

	it('keeps the weight when bodyweight is unknown or false', () => {
		const [unknown, off] = toLiveExerciseInputs(
			draftOf(
				exercise({ isBodyweight: null }),
				exercise({ rowKey: KEY_2, clientKey: KEY_2, isBodyweight: false }),
			),
		)

		expect(unknown?.sets[0]?.weightKg).toBe(50)
		expect(off?.sets[0]?.weightKg).toBe(50)
	})

	it('sends doneAt as ISO only for done sets, null for the rest', () => {
		const mixed = exercise({ sets: [set({ doneAt: DONE_AT }), set()] })

		const [input] = toLiveExerciseInputs(draftOf(mixed))

		expect(input?.sets.map((s) => s.doneAt)).toEqual([DONE_AT, null])
	})

	it('builds the PUT body with knownEditedAt', () => {
		expect(toLiveUpdate(draftOf(exercise()), LIVE_EDITED_AT)).toEqual({
			knownEditedAt: LIVE_EDITED_AT,
			exercises: [expect.objectContaining({ clientKey: KEY_1 })],
		})
		expect(toLiveUpdate(draftOf(), null)).toEqual({ knownEditedAt: null, exercises: [] })
	})

	it('round-trips through buildLiveDraft with the stable clientKey', () => {
		const inputs = toLiveExerciseInputs(draftOf(exercise()))

		const rebuilt = buildLiveDraft(makeLiveResponse(), { unsent: inputs })

		expect(rebuilt.exercises[0]?.clientKey).toBe(KEY_1)
		expect(toLiveExerciseInputs(rebuilt)).toEqual(inputs)
	})
})

describe('current and next set', () => {
	it('finds the first and the second set still to do, skipping done ones and chat exercises', () => {
		const chat = exercise({
			rowKey: 'c',
			clientKey: null,
			readOnly: true,
			sets: [set()],
		})
		const mine = exercise({ sets: [set({ doneAt: DONE_AT }), set(), set()] })

		const draft = draftOf(chat, mine)

		expect(getCurrentSet(draft)).toEqual({ exerciseIndex: 1, setIndex: 1 })
		expect(getNextSet(draft)).toEqual({ exerciseIndex: 1, setIndex: 2 })
	})

	it('crosses to the next exercise', () => {
		const first = exercise({ sets: [set({ doneAt: DONE_AT }), set()] })
		const second = exercise({ rowKey: KEY_2, clientKey: KEY_2 })

		expect(getNextSet(draftOf(first, second))).toEqual({ exerciseIndex: 1, setIndex: 0 })
	})

	it('returns null when all is done or nothing exists', () => {
		const done = exercise({ sets: [set({ doneAt: DONE_AT })] })

		expect(getCurrentSet(draftOf(done))).toBeNull()
		expect(getNextSet(draftOf(done))).toBeNull()
		expect(getCurrentSet(draftOf())).toBeNull()
	})

	it('has no next set when the current one is the last', () => {
		const last = exercise({ sets: [set()] })

		expect(getCurrentSet(draftOf(last))).toEqual({ exerciseIndex: 0, setIndex: 0 })
		expect(getNextSet(draftOf(last))).toBeNull()
	})
})

describe('getElapsedMinutes', () => {
	const NOW = new Date('2026-11-02T09:23:59.000Z')

	it('counts whole minutes since the start', () => {
		expect(getElapsedMinutes(LIVE_STARTED_AT, NOW)).toBe(23)
	})

	it('is 0 without a start and before the start (a clock a bit off)', () => {
		expect(getElapsedMinutes(null, NOW)).toBe(0)
		expect(getElapsedMinutes('2026-11-02T09:30:00.000Z', NOW)).toBe(0)
	})
})

describe('applyProgressHint', () => {
	const withHint = (overrides: Partial<LiveDraftExercise> = {}): LiveDraftExercise =>
		exercise({
			plan: {
				sets: 3,
				repsMin: 8,
				repsMax: 10,
				weightKg: 50,
				progressStepKg: 2.5,
				restSec: null,
				durationMin: null,
				isBodyweight: null,
				lastSets: null,
				progressHintKg: 55,
			},
			...overrides,
		})

	it('puts the hint into the working sets still to do, not into done sets or the warm-up', () => {
		const applied = applyProgressHint(
			withHint({
				sets: [set({ isWarmup: true, weightKg: 20 }), set({ doneAt: DONE_AT }), set(), set()],
			}),
		)

		expect(applied.sets.map((s) => s.weightKg)).toEqual([20, 50, 55, 55])
	})

	it('does nothing without a hint', () => {
		const plain = withHint()
		const noHint = { ...plain, plan: plain.plan && { ...plain.plan, progressHintKg: null } }

		expect(applyProgressHint(noHint)).toBe(noHint)
		expect(applyProgressHint(exercise())).toEqual(exercise())
	})

	it('does nothing for a bodyweight exercise', () => {
		const pullups = withHint({ isBodyweight: true, sets: [set({ weightKg: null })] })

		expect(applyProgressHint(pullups).sets[0]?.weightKg).toBeNull()
	})
})

describe('live-draft-edit', () => {
	it('patchSet changes only that set', () => {
		const next = patchSet(draftOf(exercise()), { exerciseIndex: 0, setIndex: 1 }, { reps: 12 })

		expect(next.exercises[0]?.sets.map((s) => s.reps)).toEqual([8, 12, 8])
	})

	it('patchSet can set a value to null', () => {
		const next = patchSet(
			draftOf(exercise()),
			{ exerciseIndex: 0, setIndex: 0 },
			{ weightKg: null },
		)

		expect(next.exercises[0]?.sets[0]?.weightKg).toBeNull()
	})

	it('never edits a read-only (chat) exercise', () => {
		const chat = exercise({ clientKey: null, readOnly: true })
		const draft = draftOf(chat)
		const ref = { exerciseIndex: 0, setIndex: 0 }

		expect(patchSet(draft, ref, { reps: 99 }).exercises[0]).toBe(chat)
		expect(setSetDone(draft, ref, DONE_AT).exercises[0]).toBe(chat)
		expect(addSet(draft, 0).exercises[0]).toBe(chat)
		expect(addWarmup(draft, 0).exercises[0]).toBe(chat)
	})

	it('setSetDone stamps and clears the time', () => {
		const ref = { exerciseIndex: 0, setIndex: 0 }
		const done = setSetDone(draftOf(exercise()), ref, DONE_AT)

		expect(done.exercises[0]?.sets[0]?.doneAt).toBe(DONE_AT)
		expect(setSetDone(done, ref, null).exercises[0]?.sets[0]?.doneAt).toBeNull()
	})

	it('addSet copies the last working set, not done', () => {
		const base = exercise({
			sets: [
				set({ reps: 5, weightKg: 100 }),
				set({ reps: 6, weightKg: 90, doneAt: DONE_AT }),
				set({ reps: 15, weightKg: 20, isWarmup: true }),
			],
		})

		const { sets } = addSet(draftOf(base), 0).exercises[0] as LiveDraftExercise

		expect(sets).toHaveLength(4)
		expect(sets[3]).toEqual(set({ reps: 6, weightKg: 90, doneAt: null }))
	})

	it('addSet on an exercise without sets adds an empty one', () => {
		const { sets } = addSet(draftOf(exercise({ sets: [] })), 0).exercises[0] as LiveDraftExercise

		expect(sets).toEqual([set({ reps: null, weightKg: null })])
	})

	it('addWarmup goes first with the reps of the first working set and no weight', () => {
		const base = exercise({ sets: [set({ reps: 6, weightKg: 80 })] })

		const { sets } = addWarmup(draftOf(base), 0).exercises[0] as LiveDraftExercise

		expect(sets).toHaveLength(2)
		expect(sets[0]).toEqual(set({ isWarmup: true, reps: 6, weightKg: null }))
		expect(sets[1]?.weightKg).toBe(80)
	})

	it('addWarmup on an empty exercise has no reps', () => {
		const { sets } = addWarmup(draftOf(exercise({ sets: [] })), 0).exercises[0] as LiveDraftExercise

		expect(sets[0]).toMatchObject({ isWarmup: true, reps: null })
	})

	it('getWorkingNumber skips warm-ups', () => {
		const base = exercise({ sets: [set({ isWarmup: true }), set(), set()] })

		expect([0, 1, 2].map((i) => getWorkingNumber(base, i))).toEqual([0, 1, 2])
	})

	it('createLiveExercise: strength starts from the last working sets', () => {
		const created = createLiveExercise(
			{
				name: 'Тяга',
				exerciseId: 'e1',
				kind: 'STRENGTH',
				muscleGroup: 'BACK',
				lastSets: [
					{ reps: 15, weightKg: 20, isWarmup: true },
					{ reps: 8, weightKg: 70, isWarmup: false },
					{ reps: 7, weightKg: 70, isWarmup: false },
				],
			},
			KEY_2,
		)

		expect(created).toMatchObject({
			clientKey: KEY_2,
			rowKey: KEY_2,
			readOnly: false,
			exerciseId: 'e1',
			plan: null,
		})
		expect(created.sets.map((s) => [s.reps, s.weightKg, s.isWarmup, s.doneAt])).toEqual([
			[8, 70, false, null],
			[7, 70, false, null],
		])
	})

	it('createLiveExercise: strength without history is one empty set', () => {
		const created = createLiveExercise(
			{ name: 'Нова', exerciseId: null, kind: 'STRENGTH', muscleGroup: null, lastSets: null },
			KEY_2,
		)

		expect(created.sets).toEqual([set({ reps: null, weightKg: null })])
		expect(created.exerciseId).toBeNull()
	})

	it('createLiveExercise: warm-up-only history also falls back to one empty set', () => {
		const created = createLiveExercise(
			{
				name: 'Нова',
				exerciseId: null,
				kind: 'STRENGTH',
				muscleGroup: null,
				lastSets: [{ reps: 15, weightKg: 20, isWarmup: true }],
			},
			KEY_2,
		)

		expect(created.sets).toEqual([set({ reps: null, weightKg: null })])
	})

	it('createLiveExercise: cardio has the default minutes and no sets', () => {
		const created = createLiveExercise(
			{ name: 'Доріжка', exerciseId: null, kind: 'CARDIO', muscleGroup: null, lastSets: null },
			KEY_2,
		)

		expect(created).toMatchObject({ kind: 'CARDIO', durationMin: NEW_CARDIO_MIN, sets: [] })
	})

	it('isExerciseDone: strength needs every set done, cardio just minutes', () => {
		expect(
			isExerciseDone(exercise({ sets: [set({ doneAt: DONE_AT }), set({ doneAt: DONE_AT })] })),
		).toBe(true)
		expect(isExerciseDone(exercise({ sets: [set({ doneAt: DONE_AT }), set()] }))).toBe(false)
		expect(isExerciseDone(exercise({ sets: [] }))).toBe(false)
		expect(isExerciseDone(exercise({ kind: 'CARDIO', sets: [], durationMin: 10 }))).toBe(true)
		expect(isExerciseDone(exercise({ kind: 'CARDIO', sets: [], durationMin: null }))).toBe(false)
	})

	it('countDoneSets counts live sets only', () => {
		const chat = exercise({ clientKey: null, readOnly: true, sets: [set({ doneAt: DONE_AT })] })
		const mine = exercise({ sets: [set({ doneAt: DONE_AT }), set()] })

		expect(countDoneSets(draftOf(chat, mine))).toBe(1)
		expect(countDoneSets(draftOf())).toBe(0)
	})

	it('getWeightStepKg: the plan step, else the default', () => {
		expect(getWeightStepKg(exercise())).toBe(2.5)
		const planned = exercise({
			plan: {
				sets: null,
				repsMin: null,
				repsMax: null,
				weightKg: null,
				progressStepKg: 1,
				restSec: null,
				durationMin: null,
				isBodyweight: null,
				lastSets: null,
				progressHintKg: null,
			},
		})
		expect(getWeightStepKg(planned)).toBe(1)
	})

	it('isBodyweightExercise: the person beats the dictionary', () => {
		const plan = {
			...(planDraft().plan as NonNullable<LiveDraftExercise['plan']>),
			isBodyweight: true,
		}

		expect(isBodyweightExercise(exercise({ plan, isBodyweight: false }))).toBe(false)
		expect(isBodyweightExercise(exercise({ plan, isBodyweight: null }))).toBe(true)
		expect(isBodyweightExercise(exercise())).toBe(false)
	})
})

describe('formatElapsed', () => {
	const start = '2026-11-02T09:00:00.000Z'
	const at = (iso: string): Date => new Date(iso)

	it('is mm:ss under an hour', () => {
		expect(formatElapsed(start, at('2026-11-02T09:23:14.000Z'))).toBe('23:14')
		expect(formatElapsed(start, at('2026-11-02T09:00:05.000Z'))).toBe('00:05')
	})

	it('is h:mm:ss from an hour', () => {
		expect(formatElapsed(start, at('2026-11-02T10:05:09.000Z'))).toBe('1:05:09')
		expect(formatElapsed(start, at('2026-11-02T10:00:00.000Z'))).toBe('1:00:00')
	})

	it('is 00:00 without a start or before it', () => {
		expect(formatElapsed(null, at('2026-11-02T09:23:14.000Z'))).toBe('00:00')
		expect(formatElapsed(start, at('2026-11-02T08:59:00.000Z'))).toBe('00:00')
	})
})
