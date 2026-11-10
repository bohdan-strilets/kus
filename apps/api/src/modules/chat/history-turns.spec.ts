import { describe, expect, it } from 'vitest'

import { PHOTO_HISTORY_MARKER } from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import type { HistoryCorrectionContext } from './history-corrections'
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

	describe('deleted entries and other markers', () => {
		const DELETED = new Set(['entry-b'])

		it('names the refs deleted later, in ref order', () => {
			const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-b', 'entry-a']]]), {
				deletedEntryIds: DELETED,
			})
			expect(turns).toEqual([
				{
					role: 'user',
					content: 'вівсянка і чай',
					loggedRefs: ['e1', 'e2'],
					deletedLoggedRefs: ['e2'],
				},
			])
		})

		it('names every ref when all the entries were deleted', () => {
			const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-b']]]), {
				deletedEntryIds: DELETED,
			})
			expect(turns[0]).toMatchObject({ loggedRefs: ['e2'], deletedLoggedRefs: ['e2'] })
			expect(turns[0]?.areLoggedEntriesDeleted).toBeUndefined()
		})

		it('says deleted later without refs only when all the entries are deleted', () => {
			const allGone = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['old-1', 'old-2']]]), {
				deletedEntryIds: new Set(['old-1', 'old-2']),
			})
			expect(allGone).toEqual([
				{
					role: 'user',
					content: 'вівсянка і чай',
					hasLoggedEntries: true,
					areLoggedEntriesDeleted: true,
				},
			])

			const someGone = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['old-1', 'old-2']]]), {
				deletedEntryIds: new Set(['old-1']),
			})
			expect(someGone).toEqual([
				{ role: 'user', content: 'вівсянка і чай', hasLoggedEntries: true },
			])
		})

		it('merges the markers of the other kinds into a user turn', () => {
			const markers = { facts: [{ kind: 'forgotten' as const }] }
			const turns = toHistoryTurns(toMessage({}), REFS, new Map([['m1', ['entry-a']]]), {
				markers,
			})
			expect(turns).toEqual([
				{ role: 'user', content: 'вівсянка і чай', loggedRefs: ['e1'], facts: markers.facts },
			])
		})

		it('gives an assistant turn no markers at all', () => {
			const turns = toHistoryTurns(
				toMessage({ role: MessageRole.ASSISTANT, content: 'Записано' }),
				REFS,
				new Map([['m1', ['entry-b']]]),
				{ deletedEntryIds: DELETED, markers: { facts: [{ kind: 'forgotten' }] } },
			)
			expect(turns).toEqual([{ role: 'assistant', content: 'Записано' }])
		})
	})

	describe('corrections', () => {
		const corrections = (
			overrides: Partial<HistoryCorrectionContext>,
		): HistoryCorrectionContext => ({
			deletedBy: new Map(),
			kusikActionsByMessageId: new Map(),
			appChangesByMessageId: new Map(),
			...overrides,
		})

		it('splits the deleted refs by who deleted them', () => {
			const turns = toHistoryTurns(
				toMessage({}),
				REFS,
				new Map([['m1', ['entry-a', 'entry-b', 'entry-c']]]),
				{
					deletedEntryIds: new Set(['entry-a', 'entry-b', 'entry-c']),
					corrections: corrections({
						deletedBy: new Map([
							['entry-a', 'kusik'],
							['entry-b', 'app'],
						]),
					}),
				},
			)
			expect(turns[0]).toMatchObject({
				deletedLoggedRefs: ['e1', 'e2', 'e3'],
				deletedByKusikLoggedRefs: ['e1'],
				deletedInAppLoggedRefs: ['e2'],
			})
		})

		it('names the author of the deletion of a turn without refs only when it is one', () => {
			const deletedEntryIds = new Set(['old-1', 'old-2'])
			const entries = new Map([['m1', ['old-1', 'old-2']]])
			const same = toHistoryTurns(toMessage({}), REFS, entries, {
				deletedEntryIds,
				corrections: corrections({
					deletedBy: new Map([
						['old-1', 'app'],
						['old-2', 'app'],
					]),
				}),
			})
			expect(same[0]).toMatchObject({ areLoggedEntriesDeleted: true, loggedDeletedBy: 'app' })
			const mixed = toHistoryTurns(toMessage({}), REFS, entries, {
				deletedEntryIds,
				corrections: corrections({
					deletedBy: new Map([
						['old-1', 'app'],
						['old-2', 'kusik'],
					]),
				}),
			})
			expect(mixed[0]?.loggedDeletedBy).toBeUndefined()
		})

		it('gives the app changes to the user turn and the actions to the reply to it', () => {
			const appChanges = [
				{ kind: 'deleted' as const, ref: 'e1', name: 'Борщ', localDate: '2026-11-04' },
			]
			const kusikActions = { deleted: [{ ref: 'e1' }], restored: [], corrected: [] }
			const context = corrections({
				appChangesByMessageId: new Map([['m1', appChanges]]),
				kusikActionsByMessageId: new Map([['m1', kusikActions]]),
			})
			const user = toHistoryTurns(toMessage({}), REFS, new Map(), { corrections: context })
			expect(user).toEqual([{ role: 'user', content: 'вівсянка і чай', appChanges }])
			const reply = toHistoryTurns(
				toMessage({ id: 'a2', role: MessageRole.ASSISTANT, content: 'Видалив', replyToId: 'm1' }),
				REFS,
				new Map(),
				{ corrections: context },
			)
			expect(reply).toEqual([{ role: 'assistant', content: 'Видалив', kusikActions }])
			const unrelated = toHistoryTurns(
				toMessage({ id: 'a3', role: MessageRole.ASSISTANT, content: 'Привіт', replyToId: null }),
				REFS,
				new Map(),
				{ corrections: context },
			)
			expect(unrelated).toEqual([{ role: 'assistant', content: 'Привіт' }])
		})
	})
})
