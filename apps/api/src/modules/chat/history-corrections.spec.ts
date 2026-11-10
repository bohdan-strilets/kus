import { describe, expect, it } from 'vitest'

import { MessageRole } from '../../generated/prisma/client'
import type { HistoryCorrection } from '../entries/history-correction'
import { buildCorrectionContext } from './history-corrections'

const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 9, 8, minute))

const HISTORY = [
	{ id: 'm1', role: MessageRole.USER, createdAt: at(1) },
	{ id: 'a2', role: MessageRole.ASSISTANT, createdAt: at(2) },
	{ id: 'm3', role: MessageRole.USER, createdAt: at(3) },
	{ id: 'a4', role: MessageRole.ASSISTANT, createdAt: at(4) },
]
const CURRENT = { id: 'm9', createdAt: at(9) }
const REFS = new Map([
	['a', 'e1'],
	['b', 'e2'],
	['c', 'e3'],
])

const toCorrection = (overrides: Partial<HistoryCorrection>): HistoryCorrection => ({
	entryId: 'a',
	messageId: null,
	createdAt: at(5),
	kind: 'deleted',
	grams: null,
	name: 'Борщ',
	localDate: '2026-11-04',
	...overrides,
})

const build = (corrections: HistoryCorrection[], refByEntryId = REFS) =>
	buildCorrectionContext({ corrections, history: HISTORY, current: CURRENT, refByEntryId })

describe('buildCorrectionContext deletedBy', () => {
	it('tells a chat deletion from the app one by the message', () => {
		const { deletedBy } = build([
			toCorrection({ entryId: 'a', messageId: 'm3', createdAt: at(3) }),
			toCorrection({ entryId: 'b' }),
		])
		expect(deletedBy).toEqual(
			new Map([
				['a', 'kusik'],
				['b', 'app'],
			]),
		)
	})

	it('lets the latest delete decide and forgets a restored entry', () => {
		const { deletedBy } = build([
			toCorrection({ entryId: 'a', messageId: 'm3', createdAt: at(3) }),
			toCorrection({ entryId: 'a', kind: 'restored', messageId: 'm3', createdAt: at(3) }),
			toCorrection({ entryId: 'a', createdAt: at(6) }),
			toCorrection({ entryId: 'b', messageId: 'm3', createdAt: at(3) }),
			toCorrection({ entryId: 'b', kind: 'restored', messageId: 'm3', createdAt: at(3) }),
		])
		expect(deletedBy).toEqual(new Map([['a', 'app']]))
	})
})

describe('buildCorrectionContext Kusik actions', () => {
	it('groups the changes of a turn by kind with the refs of the request, in ref order', () => {
		const { kusikActionsByMessageId } = build([
			toCorrection({ entryId: 'c', messageId: 'm3' }),
			toCorrection({ entryId: 'a', messageId: 'm3' }),
			toCorrection({ entryId: 'b', messageId: 'm3', kind: 'restored' }),
		])
		expect(kusikActionsByMessageId.get('m3')).toEqual({
			deleted: [{ ref: 'e1' }, { ref: 'e3' }],
			restored: [{ ref: 'e2' }],
			corrected: [],
		})
	})

	it('keeps the last weight of a corrected entry and leaves the other turns without actions', () => {
		const { kusikActionsByMessageId } = build([
			toCorrection({ entryId: 'a', messageId: 'm1', kind: 'edited', grams: 60 }),
			toCorrection({ entryId: 'a', messageId: 'm1', kind: 'edited', grams: 45 }),
			toCorrection({ entryId: 'b', messageId: 'm1', kind: 'edited', grams: null }),
		])
		expect(kusikActionsByMessageId.get('m1')?.corrected).toEqual([
			{ ref: 'e1', grams: 45 },
			{ ref: 'e2' },
		])
		expect(kusikActionsByMessageId.has('m3')).toBe(false)
	})

	it('counts an entry deleted after an edit as deleted only, and keeps a ref-less one', () => {
		const { kusikActionsByMessageId } = build([
			toCorrection({ entryId: 'a', messageId: 'm1', kind: 'edited', grams: 60 }),
			toCorrection({ entryId: 'a', messageId: 'm1' }),
			toCorrection({ entryId: 'gone', messageId: 'm1' }),
		])
		expect(kusikActionsByMessageId.get('m1')).toEqual({
			deleted: [{ ref: 'e1' }, { ref: null }],
			restored: [],
			corrected: [],
		})
	})
})

describe('buildCorrectionContext app changes', () => {
	it('places a change in front of the next user message, the current one included', () => {
		const { appChangesByMessageId } = build([
			toCorrection({ entryId: 'a', createdAt: at(2) }),
			toCorrection({ entryId: 'b', createdAt: at(6) }),
		])
		// at(2) is exactly when Kusik answered: before m3
		expect(appChangesByMessageId.get('m3')).toBeUndefined()
		expect(appChangesByMessageId.get('m9')).toEqual([
			{ kind: 'deleted', ref: 'e2', name: 'Борщ', localDate: '2026-11-04' },
		])
	})

	it('puts a change made between two messages in front of the later one', () => {
		const { appChangesByMessageId } = build([
			toCorrection({ entryId: 'a', createdAt: new Date(at(2).getTime() + 1000) }),
		])
		expect(appChangesByMessageId.get('m3')).toEqual([
			{ kind: 'deleted', ref: 'e1', name: 'Борщ', localDate: '2026-11-04' },
		])
		expect(appChangesByMessageId.has('m9')).toBe(false)
	})

	it('has no predecessor for the first message', () => {
		const { appChangesByMessageId } = build([toCorrection({ createdAt: at(0) })])
		expect(appChangesByMessageId.size).toBe(0)
	})

	it('ignores the changes of the chat and a delete undone in the app', () => {
		const { appChangesByMessageId } = build([
			toCorrection({ entryId: 'a', messageId: 'm3', createdAt: at(6) }),
			toCorrection({ entryId: 'b', createdAt: at(6) }),
			toCorrection({ entryId: 'b', kind: 'restored', createdAt: at(7) }),
		])
		expect(appChangesByMessageId.size).toBe(0)
	})

	it('reports an edit once per entry and a deleted entry as deleted', () => {
		const { appChangesByMessageId } = build([
			toCorrection({ entryId: 'a', kind: 'edited', createdAt: at(5) }),
			toCorrection({ entryId: 'a', kind: 'edited', createdAt: at(6) }),
			toCorrection({ entryId: 'b', kind: 'edited', createdAt: at(5) }),
			toCorrection({ entryId: 'b', createdAt: at(7) }),
		])
		expect(appChangesByMessageId.get('m9')).toEqual([
			{ kind: 'edited', ref: 'e1', name: 'Борщ', localDate: '2026-11-04' },
			{ kind: 'deleted', ref: 'e2', name: 'Борщ', localDate: '2026-11-04' },
		])
	})

	it('keeps the newest five and leaves out the ref of an entry the request does not list', () => {
		const corrections = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((entryId, index) =>
			toCorrection({ entryId, createdAt: at(5 + index / 10) }),
		)
		const changes = build(corrections).appChangesByMessageId.get('m9') ?? []
		expect(changes).toHaveLength(5)
		expect(changes.map(({ ref }) => ref)).toEqual(['e3', null, null, null, null])
	})
})
