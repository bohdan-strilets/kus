import { describe, expect, it } from 'vitest'

import { PHOTO_HISTORY_MARKER } from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import { toHistoryTurns } from './history-turns'

// Contract: toHistoryTurns(message, refByEntryId, entryIdsBySourceMessageId) -> HistoryTurn[]
//  - refByEntryId: entry id -> `e1`… of this request (active and deleted entries in the context window)
//  - entryIdsBySourceMessageId: message id -> ids of ALL the day's FoodEntry rows with that
//    sourceMessageId, also those that fell out of the context window (they have no ref)
//  - no entries: neither loggedRefs nor hasLoggedEntries is set (undefined, not an empty array)
//  - entries without any ref: hasLoggedEntries = true, loggedRefs is omitted
type Message = Parameters<typeof toHistoryTurns>[0]

const toMessage = (overrides: Partial<Record<keyof Message, unknown>>): Message =>
	({
		id: 'm1',
		role: MessageRole.USER,
		content: 'вівсянка і чай',
		attachments: [],
		...overrides,
	}) as unknown as Message

const REFS = new Map([
	['entry-a', 'e1'],
	['entry-b', 'e2'],
	['entry-c', 'e3'],
])

describe('toHistoryTurns', () => {
	it('gives a user turn the refs of the entries it logged, in ref order', () => {
		const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-b', 'entry-a']]]))
		expect(turns).toEqual([{ role: 'user', content: 'вівсянка і чай', loggedRefs: ['e1', 'e2'] }])
	})

	it('does not mark an assistant turn even when entries point at its message', () => {
		const turns = toHistoryTurns(
			toMessage({ role: MessageRole.ASSISTANT, content: 'Записано' }),
			REFS,
			new Map([['m1', ['entry-a']]]),
		)
		expect(turns).toEqual([{ role: 'assistant', content: 'Записано' }])
	})

	it('does not mark an assistant turn whose entries have no ref either', () => {
		const turns = toHistoryTurns(
			toMessage({ role: MessageRole.ASSISTANT, content: 'Записано' }),
			REFS,
			new Map([['m1', ['entry-old']]]),
		)
		expect(turns).toEqual([{ role: 'assistant', content: 'Записано' }])
	})

	it('leaves a user turn without entries unmarked', () => {
		const turns = toHistoryTurns(toMessage({}), REFS, new Map())
		expect(turns).toEqual([{ role: 'user', content: 'вівсянка і чай' }])
		expect(turns[0]?.loggedRefs).toBeUndefined()
		expect(turns[0]?.hasLoggedEntries).toBeUndefined()
	})

	it('ignores entries of another message', () => {
		const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m2', ['entry-a']]]))
		expect(turns).toEqual([{ role: 'user', content: 'вівсянка і чай' }])
	})

	it('marks a turn whose entries all fell out of the context window as logged, without refs', () => {
		const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-old']]]))
		expect(turns).toEqual([{ role: 'user', content: 'вівсянка і чай', hasLoggedEntries: true }])
		expect(turns[0]?.loggedRefs).toBeUndefined()
	})

	it('lists only the refs that exist when some entries fell out of the window', () => {
		const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-a', 'entry-gone']]]))
		expect(turns).toEqual([{ role: 'user', content: 'вівсянка і чай', loggedRefs: ['e1'] }])
		expect(turns[0]?.hasLoggedEntries).toBeUndefined()
	})

	it('keeps the photo marker next to the logged refs', () => {
		const turns = toHistoryTurns(
			toMessage({ attachments: [{ id: 'att1' }], content: 'обід' }),
			REFS,
			new Map([['m1', ['entry-c']]]),
		)
		expect(turns).toEqual([{ role: 'user', content: 'обід', hasPhoto: true, loggedRefs: ['e3'] }])
		expect(PHOTO_HISTORY_MARKER).toBe('[фото]')
	})

	it('flags a photo turn whose entries have no ref', () => {
		const turns = toHistoryTurns(
			toMessage({ attachments: [{ id: 'att1' }], content: null }),
			REFS,
			new Map([['m1', ['entry-old']]]),
		)
		expect(turns).toEqual([{ role: 'user', content: '', hasPhoto: true, hasLoggedEntries: true }])
	})

	it('still marks a photo without words as a photo turn', () => {
		const turns = toHistoryTurns(
			toMessage({ attachments: [{ id: 'att1' }], content: null }),
			REFS,
			new Map(),
		)
		expect(turns).toEqual([{ role: 'user', content: '', hasPhoto: true }])
	})

	it('drops a message without text and photo', () => {
		expect(toHistoryTurns(toMessage({ content: null }), REFS, new Map())).toEqual([])
	})
})
