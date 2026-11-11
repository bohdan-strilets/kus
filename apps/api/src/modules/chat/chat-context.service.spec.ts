import { describe, expect, it, vi } from 'vitest'

import { MessageRole } from '../../generated/prisma/client'
import { NO_TEMPLATE_REFS } from '../programs/program-chat-context'
import { ChatContextService } from './chat-context.service'

const TODAY = new Date('2026-10-18T00:00:00Z')

const toEntry = (id: string, sourceMessageId: string | null, localDate = TODAY) => ({
	id,
	sourceMessageId,
	name: id,
	grams: 100,
	kcal: 100,
	proteinG: 1,
	fatG: 1,
	carbsG: 1,
	fiberG: 0,
	category: 'OTHER',
	source: 'ESTIMATE',
	isEdited: false,
	meal: { type: 'LUNCH', localDate },
})

// the ids of the specs grow with time, like the uuid v7 of real messages
const toCreatedAt = (id: string): Date => new Date(Date.UTC(2026, 9, 18, 8, Number(id.slice(1))))

const toUserMessage = (id: string, content: string) => ({
	id,
	role: MessageRole.USER,
	content,
	attachments: [],
	replyToId: null,
	createdAt: toCreatedAt(id),
})

const toMeasurement = (kind: string, localDate: string, value: number) => ({
	kind,
	localDate: new Date(`${localDate}T00:00:00Z`),
	value,
})

interface Mocks {
	editable?: unknown
	history?: unknown[]
	daysKcal?: Map<string, { kcal: number; entryCount: number }>
	goalKcal?: Map<string, number | null>
	range?: Record<string, unknown[]>
	/** What the programs service returns for «Program». */
	program?: unknown
	/** The newest card while OPEN. */
	openCard?: unknown
	/** What the history markers service returns: message id → markers. */
	markers?: Map<string, unknown>
	/** User message id → digests of what Kusik read in its turn. */
	readDigests?: Map<string, string[]>
	/** The user's confirmed facts, oldest first. */
	facts?: { id: string; text: string }[]
	/** What the entries service returns as the corrections of the history, oldest first. */
	corrections?: unknown[]
}

const createService = ({
	editable = { active: [], deleted: [], sourceMessages: [] },
	history = [],
	daysKcal = new Map(),
	goalKcal = new Map(),
	range = {},
	program = { program: null, pendingProgram: null, refIds: NO_TEMPLATE_REFS },
	openCard = null,
	markers = new Map(),
	readDigests = new Map(),
	facts = [],
	corrections = [],
}: Mocks = {}) => {
	const findHistoryCorrections = vi.fn().mockResolvedValue(corrections)
	const getProgramContext = vi.fn().mockResolvedValue(program)
	const findContextFacts = vi.fn().mockResolvedValue({ confirmed: facts, proposal: null })
	const getMarkers = vi.fn().mockResolvedValue(markers)
	const getReadDigests = vi.fn().mockResolvedValue(readDigests)
	const getFoodActions = vi.fn().mockResolvedValue(new Map())
	const getEditableEntries = vi.fn().mockResolvedValue(editable)
	const getDaysKcal = vi.fn().mockResolvedValue(daysKcal)
	const findInRange = vi
		.fn()
		.mockImplementation(({ kind }: { kind: string }) => Promise.resolve(range[kind] ?? []))
	const service = new ChatContextService(
		{ findHistory: vi.fn().mockResolvedValue(history) } as never,
		{ findOpenClarifications: vi.fn().mockResolvedValue([]) } as never,
		{ getContext: vi.fn().mockResolvedValue({ earlier: [], copyRefIds: new Map() }) } as never,
		{ getMarkers, getReadDigests, getFoodActions } as never,
		{
			getDaySummary: vi.fn().mockResolvedValue({ totals: {}, meals: [] }),
			getEditableEntries,
			getValuesBefore: vi.fn().mockResolvedValue(new Map()),
			getDaysKcal,
			findHistoryCorrections,
		} as never,
		{
			getGoalForDate: vi.fn().mockResolvedValue(null),
			getGoalKcalByDay: vi.fn().mockResolvedValue(goalKcal),
		} as never,
		{
			findRecent: vi.fn().mockResolvedValue([]),
			findLatest: vi.fn().mockResolvedValue(null),
			findInRange,
		} as never,
		{ findTargetWeightKg: vi.fn().mockResolvedValue(null) } as never,
		{
			getContext: vi.fn().mockResolvedValue({
				workouts: [],
				deletedWorkouts: [],
				exercises: [],
				refIds: { workouts: new Map(), deletedWorkouts: new Map(), exercises: new Map() },
			}),
		} as never,
		{ findContextFacts } as never,
		{ getContext: getProgramContext } as never,
		{ findOpenCard: vi.fn().mockResolvedValue(openCard) } as never,
	)
	return {
		service,
		getEditableEntries,
		getDaysKcal,
		findInRange,
		findContextFacts,
		getProgramContext,
		getMarkers,
		getReadDigests,
		findHistoryCorrections,
	}
}

const build = (service: ChatContextService, text = '', messageId = 'm3') =>
	service.buildContext({
		userId: 'u1',
		timezone: 'Europe/Warsaw',
		message: toUserMessage(messageId, text) as never,
		text,
		now: new Date('2026-10-18T10:00:00Z'),
		localDate: TODAY,
		memory: [],
	})

describe('ChatContextService.buildContext history markers', () => {
	it('marks a turn logged also when its entries fell out of the context window', async () => {
		// the window holds only entry "in-window"; "out-of-window" (message m1) was trimmed away
		const { service } = createService({
			history: [toUserMessage('m2', 'чай'), toUserMessage('m1', 'борщ')],
			editable: {
				active: [toEntry('in-window', 'm2')],
				deleted: [],
				sourceMessages: [
					{ id: 'out-of-window', sourceMessageId: 'm1' },
					{ id: 'in-window', sourceMessageId: 'm2' },
				],
			},
		})

		const { context } = await build(service)

		expect(context.history).toEqual([
			{ role: 'user', content: 'борщ', hasLoggedEntries: true },
			{ role: 'user', content: 'чай', loggedRefs: ['e1'] },
		])
	})
})

describe('ChatContextService.buildContext history marker sources', () => {
	it('names the entries of a turn that were deleted later', async () => {
		const { service } = createService({
			history: [toUserMessage('m2', 'вівсянка і чай')],
			editable: {
				active: [toEntry('kept', 'm2')],
				deleted: [toEntry('gone', 'm2')],
				sourceMessages: [
					{ id: 'kept', sourceMessageId: 'm2', isDeleted: false },
					{ id: 'gone', sourceMessageId: 'm2', isDeleted: true },
				],
			},
		})

		const { context } = await build(service)

		expect(context.history).toEqual([
			{
				role: 'user',
				content: 'вівсянка і чай',
				loggedRefs: ['e1', 'e2'],
				deletedLoggedRefs: ['e2'],
			},
		])
	})

	it('says the turn is deleted later when no entry of it has a ref', async () => {
		const { service } = createService({
			history: [toUserMessage('m1', 'борщ')],
			editable: {
				active: [],
				deleted: [],
				sourceMessages: [{ id: 'old', sourceMessageId: 'm1', isDeleted: true }],
			},
		})

		const { context } = await build(service)

		expect(context.history).toEqual([
			{ role: 'user', content: 'борщ', hasLoggedEntries: true, areLoggedEntriesDeleted: true },
		])
	})

	it('adds the markers of the other kinds to their turn, asking for the user turns only', async () => {
		const workout = { refs: ['w1'], deletedRefs: [], isDeleted: false }
		const { service, getMarkers } = createService({
			history: [toAssistantMessage('a1', 'Записано'), toUserMessage('m2', 'жим 80×8')],
			markers: new Map([['m2', { workout }]]),
		})

		const { context } = await build(service)

		expect(getMarkers).toHaveBeenCalledWith(expect.objectContaining({ messageIds: ['m2'] }))
		expect(context.history).toEqual([
			{ role: 'user', content: 'жим 80×8', workout },
			{ role: 'assistant', content: 'Записано' },
		])
	})

	it('puts what Kusik read in front of its reply, asking for the user messages of the history', async () => {
		const read = 'read workouts 01.11–10.11: 3 (01.11, 05.11, 09.11)'
		const { service, getReadDigests } = createService({
			// newest first, like the repository returns it
			history: [toAssistantMessage('a2', 'Три', 'm2'), toUserMessage('m2', 'Скільки тренувань?')],
			readDigests: new Map([['m2', [read]]]),
		})

		const { context } = await build(service)

		expect(getReadDigests).toHaveBeenCalledWith('u1', ['m2'])
		expect(context.history).toEqual([
			{ role: 'user', content: 'Скільки тренувань?' },
			{ role: 'assistant', content: 'Три', reads: [read] },
		])
	})

	it('hands the f-refs of the facts of the request to the markers', async () => {
		const { service, getMarkers } = createService({
			history: [toUserMessage('m2', "запам'ятай")],
			facts: [
				{ id: 'fact-a', text: 'А' },
				{ id: 'fact-b', text: 'Б' },
			],
		})

		await build(service)

		expect(getMarkers).toHaveBeenCalledWith(
			expect.objectContaining({
				factRefById: new Map([
					['fact-a', 'f1'],
					['fact-b', 'f2'],
				]),
			}),
		)
	})
})

const toCorrection = (overrides: Record<string, unknown>) => ({
	entryId: 'borsch',
	messageId: null,
	createdAt: toCreatedAt('x0'),
	kind: 'deleted',
	grams: null,
	name: 'Борщ',
	localDate: '2026-10-18',
	...overrides,
})

describe('ChatContextService.buildContext correction markers', () => {
	const loggedBorsch = {
		active: [],
		deleted: [toEntry('borsch', 'm1')],
		sourceMessages: [{ id: 'borsch', sourceMessageId: 'm1', isDeleted: true }],
	}

	it('says the user deleted it in the app, in the turn and in front of the next message', async () => {
		const { service, findHistoryCorrections } = createService({
			history: [toAssistantMessage('a2', 'Записав борщ', 'm1'), toUserMessage('m1', 'борщ')],
			editable: loggedBorsch,
			// after Kusik's reply (2), before the message being answered (9)
			corrections: [toCorrection({ createdAt: toCreatedAt('x5') })],
		})

		const { context } = await build(service, 'чому ти видалив борщ?', 'm9')

		expect(findHistoryCorrections).toHaveBeenCalledWith({
			userId: 'u1',
			entryIds: ['borsch'],
			messageIds: ['m1'],
			since: toCreatedAt('m1'),
		})
		expect(context.history[0]).toMatchObject({
			role: 'user',
			loggedRefs: ['e1'],
			deletedLoggedRefs: ['e1'],
			deletedInAppLoggedRefs: ['e1'],
		})
		expect(context.history[0]?.deletedByKusikLoggedRefs).toBeUndefined()
		expect(context.appChanges).toEqual([
			{ kind: 'deleted', ref: 'e1', name: 'Борщ', localDate: '2026-10-18' },
		])
	})

	it('says Kusik deleted it when a chat turn did, and puts the action on Kusik reply', async () => {
		const { service } = createService({
			history: [
				toAssistantMessage('a4', 'Видалив', 'm3'),
				toUserMessage('m3', 'видали борщ'),
				toAssistantMessage('a2', 'Записав борщ', 'm1'),
				toUserMessage('m1', 'борщ'),
			],
			editable: loggedBorsch,
			corrections: [toCorrection({ messageId: 'm3', createdAt: toCreatedAt('x3') })],
		})

		const { context } = await build(service, 'ок', 'm9')

		expect(context.history[0]).toMatchObject({ deletedByKusikLoggedRefs: ['e1'] })
		expect(context.history[3]).toEqual({
			role: 'assistant',
			content: 'Видалив',
			kusikActions: { deleted: [{ ref: 'e1' }], restored: [], corrected: [] },
		})
		expect(context.appChanges).toBeUndefined()
	})

	it('marks the reply of the turn that restored an entry', async () => {
		const { service } = createService({
			history: [
				toAssistantMessage('a6', 'Повернув', 'm5'),
				toUserMessage('m5', 'поверни борщ'),
				toAssistantMessage('a4', 'Видалив', 'm3'),
				toUserMessage('m3', 'видали борщ'),
			],
			editable: {
				active: [toEntry('borsch', 'm1')],
				deleted: [],
				sourceMessages: [{ id: 'borsch', sourceMessageId: 'm1', isDeleted: false }],
			},
			corrections: [
				toCorrection({ messageId: 'm3', createdAt: toCreatedAt('x3') }),
				toCorrection({ messageId: 'm5', kind: 'restored', createdAt: toCreatedAt('x5') }),
			],
		})

		const { context } = await build(service, 'дякую', 'm9')

		expect(context.history.map(({ kusikActions }) => kusikActions)).toEqual([
			undefined,
			{ deleted: [{ ref: 'e1' }], restored: [], corrected: [] },
			undefined,
			{ deleted: [], restored: [{ ref: 'e1' }], corrected: [] },
		])
	})

	it('asks for no corrections without a history', async () => {
		const { service, findHistoryCorrections } = createService()

		const { context } = await build(service, 'привіт', 'm9')

		expect(findHistoryCorrections).not.toHaveBeenCalled()
		expect(context.appChanges).toBeUndefined()
	})
})

describe('ChatContextService.buildContext other days', () => {
	it('fills Days for today − 3 … today + 1 from the backend totals and goals', async () => {
		const { service, getDaysKcal } = createService({
			daysKcal: new Map([['2026-10-17', { kcal: 2300, entryCount: 4 }]]),
			goalKcal: new Map([['2026-10-17', 2000]]),
		})

		const { context } = await build(service)

		expect(getDaysKcal).toHaveBeenCalledWith('u1', {
			from: new Date('2026-10-15T00:00:00Z'),
			to: new Date('2026-10-19T00:00:00Z'),
		})
		expect(context.days?.map(({ localDate, label }) => [localDate, label])).toEqual([
			['2026-10-15', null],
			['2026-10-16', null],
			['2026-10-17', 'yesterday'],
			['2026-10-18', 'today'],
			['2026-10-19', 'tomorrow'],
		])
		expect(context.days?.[2]).toMatchObject({ kcal: 2300, overKcal: 300, entryCount: 4 })
	})

	it('lists the live measurements of the last 7 days, both kinds', async () => {
		const { service, findInRange } = createService({
			range: {
				WEIGHT: [toMeasurement('WEIGHT', '2026-10-12', 82.4)],
				WAIST: [toMeasurement('WAIST', '2026-10-17', 94)],
			},
		})

		const { context } = await build(service)

		expect(findInRange).toHaveBeenCalledWith({
			userId: 'u1',
			kind: 'WEIGHT',
			from: new Date('2026-10-11T00:00:00Z'),
			to: TODAY,
		})
		expect(context.measurements.recent).toEqual([
			{ kind: 'WEIGHT', localDate: '2026-10-12', value: 82.4 },
			{ kind: 'WAIST', localDate: '2026-10-17', value: 94 },
		])
	})

	it('asks for entries of the other days written since the start of the user day', async () => {
		const { service, getEditableEntries } = createService({
			editable: {
				active: [
					toEntry('today', 'm1'),
					toEntry('yesterday', 'm2', new Date('2026-10-17T00:00:00Z')),
				],
				deleted: [],
				sourceMessages: [],
			},
		})

		const { context } = await build(service)

		expect(getEditableEntries).toHaveBeenCalledWith('u1', TODAY, {
			from: new Date('2026-10-15T00:00:00Z'),
			to: new Date('2026-10-19T00:00:00Z'),
			// 00:00 on Oct 18 in Warsaw (UTC+2)
			createdSince: new Date('2026-10-17T22:00:00Z'),
		})
		expect(context.entries.map(({ ref, date }) => [ref, date])).toEqual([
			['e1', undefined],
			['e2', '2026-10-17'],
		])
	})
})

const toAssistantMessage = (id: string, content: string, replyToId: string | null = null) => ({
	id,
	role: MessageRole.ASSISTANT,
	content,
	attachments: [],
	replyToId,
	createdAt: toCreatedAt(id),
})

const PENDING_PROGRAM = { mode: 'ROTATE', perWeek: 2, title: null, templates: [] }

describe('ChatContextService.buildContext «Program»', () => {
	it('hands the open card over as the proposal and returns its refs and base version', async () => {
		const refIds = { keys: new Map([['t1', 'key-a']]), ids: new Map(), baseVersionId: null }
		const openCard = { v: 1, baseVersionId: null, program: { templates: [] } }
		const { service, getProgramContext } = createService({
			openCard,
			program: { program: null, pendingProgram: PENDING_PROGRAM, refIds },
		})

		const { context, templateRefIds } = await build(service, 'заміни жим ногами на присідання')

		expect(getProgramContext).toHaveBeenCalledWith('u1', {
			exerciseRefs: new Map(),
			pending: openCard.program,
		})
		expect(context.pendingProgram).toEqual(PENDING_PROGRAM)
		// the proposal brings the rules with the section: no separate flag
		expect(context.hasProgramRules).toBeUndefined()
		expect(templateRefIds).toBe(refIds)
	})

	it('gives the rules without a program for a talk about one in the last 4 turns', async () => {
		const { service } = createService({
			// newest first, as the repository returns them
			history: [
				toAssistantMessage('m2', 'Можна 3 рази на тиждень.'),
				toUserMessage('m1', 'скільки разів тренуватись?'),
			],
		})

		const { context } = await build(service, 'давай так')

		expect(context.hasProgramRules).toBe(true)
		expect(context.pendingProgram).toBeUndefined()
	})

	it('gives no rules when neither the message nor the last 4 turns talk about a program', async () => {
		const { service } = createService({
			history: [
				toAssistantMessage('m5', 'Записав.'),
				toUserMessage('m4', 'чай'),
				toAssistantMessage('m3', 'Записав.'),
				toUserMessage('m2', 'гречка'),
				toUserMessage('m1', 'склади програму'),
			],
		})

		const { context } = await build(service, 'давай так')

		expect(context.hasProgramRules).toBeUndefined()
	})
})
