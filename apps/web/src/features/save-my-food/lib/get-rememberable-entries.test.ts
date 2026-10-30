import type { FoodEntryResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import {
	getInitialSelection,
	getRememberableEntries,
	getSelectedIds,
} from './get-rememberable-entries'

// only the fields the helpers read
const entry = (id: string, canRemember: boolean): FoodEntryResponse =>
	({ id, canRemember }) as unknown as FoodEntryResponse

const ENTRIES = [entry('a', true), entry('b', false), entry('c', true)]

describe('getRememberableEntries', () => {
	it('keeps only the lines with canRemember', () => {
		expect(getRememberableEntries(ENTRIES).map((item) => item.id)).toEqual(['a', 'c'])
	})

	it('finds nothing when the API sent no flag (it defaults to false)', () => {
		expect(getRememberableEntries([entry('a', false)])).toEqual([])
	})
})

describe('getInitialSelection', () => {
	it('checks every new line and none of the others', () => {
		expect([...getInitialSelection(ENTRIES)]).toEqual(['a', 'c'])
	})
})

describe('getSelectedIds', () => {
	it('returns the ids in the order of the card', () => {
		expect(getSelectedIds(ENTRIES, new Set(['c', 'a']))).toEqual(['a', 'c'])
	})

	it('returns nothing when nothing is checked', () => {
		expect(getSelectedIds(ENTRIES, new Set())).toEqual([])
	})
})
