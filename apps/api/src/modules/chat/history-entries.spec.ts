import { describe, expect, it } from 'vitest'

import {
	getDeletedEntryIds,
	groupEntryIdsBySourceMessage,
	mergeSourceEntries,
} from './history-entries'

describe('groupEntryIdsBySourceMessage', () => {
	it('groups the entry ids by their message and skips entries without one', () => {
		const grouped = groupEntryIdsBySourceMessage([
			{ id: 'a', sourceMessageId: 'm1' },
			{ id: 'b', sourceMessageId: null },
			{ id: 'c', sourceMessageId: 'm1' },
			{ id: 'd', sourceMessageId: 'm2' },
		])

		expect(grouped).toEqual(
			new Map([
				['m1', ['a', 'c']],
				['m2', ['d']],
			]),
		)
	})
})

describe('mergeSourceEntries', () => {
	it('counts an entry that is in both lists once, the day first', () => {
		expect(mergeSourceEntries([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])).toEqual([
			{ id: 'a' },
			{ id: 'b' },
			{ id: 'c' },
		])
	})
})

describe('getDeletedEntryIds', () => {
	it('keeps the ids of the deleted entries only', () => {
		expect(
			getDeletedEntryIds([
				{ id: 'a', isDeleted: false },
				{ id: 'b', isDeleted: true },
			]),
		).toEqual(new Set(['b']))
	})
})
