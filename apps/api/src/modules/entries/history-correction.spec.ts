import { describe, expect, it } from 'vitest'

import { toHistoryCorrection } from './history-correction'

const toRow = (after: unknown, messageId: string | null = null) => ({
	foodEntryId: 'entry-1',
	messageId,
	createdAt: new Date('2026-11-04T10:00:00Z'),
	after: after as never,
	foodEntry: { name: 'Борщ', meal: { localDate: new Date('2026-11-04T00:00:00Z') } },
})

describe('toHistoryCorrection', () => {
	it('reads a delete, a restore and an edit from the stored after-values', () => {
		expect(toHistoryCorrection(toRow({ deleted: true })).kind).toBe('deleted')
		expect(toHistoryCorrection(toRow({ deleted: false })).kind).toBe('restored')
		expect(toHistoryCorrection(toRow({ grams: 45, kcal: 90 }))).toMatchObject({
			kind: 'edited',
			grams: 45,
		})
		expect(toHistoryCorrection(toRow({ mealType: 'LUNCH' }))).toMatchObject({
			kind: 'edited',
			grams: null,
		})
	})

	it('carries the entry, the author, the name and the day', () => {
		expect(toHistoryCorrection(toRow({ deleted: true }, 'm1'))).toEqual({
			entryId: 'entry-1',
			messageId: 'm1',
			createdAt: new Date('2026-11-04T10:00:00Z'),
			kind: 'deleted',
			grams: null,
			name: 'Борщ',
			localDate: '2026-11-04',
		})
	})

	it('treats an unreadable after-value as an edit without a weight', () => {
		expect(toHistoryCorrection(toRow(null))).toMatchObject({ kind: 'edited', grams: null })
	})
})
