import { describe, expect, it } from 'vitest'

import { buildEditContext } from './edit-context'

type Active = Parameters<typeof buildEditContext>[0]['active']

const toEntry = (id: string, overrides: Record<string, unknown> = {}): Active[number] =>
	({
		id,
		name: `name-${id}`,
		grams: 100,
		kcal: 200,
		proteinG: 10,
		fatG: 5,
		carbsG: 20,
		fiberG: 2,
		category: 'OTHER',
		source: 'ESTIMATE',
		isEdited: false,
		meal: { type: 'LUNCH', localDate: new Date('2026-10-18T00:00:00Z') },
		...overrides,
	}) as unknown as Active[number]

describe('buildEditContext', () => {
	const context = buildEditContext({
		active: [toEntry('a1'), toEntry('a2', { isEdited: true })],
		deleted: [toEntry('d1'), toEntry('d2')],
		clarifications: [],
		today: '2026-10-18',
	})

	it('maps active and deleted entry ids to refs, deleted ones continuing after the active', () => {
		expect([...context.refByEntryId]).toEqual([
			['a1', 'e1'],
			['a2', 'e2'],
			['d1', 'e3'],
			['d2', 'e4'],
		])
	})

	it('keeps the ref maps for the edit tools consistent with refByEntryId', () => {
		expect([...context.refIds.entries]).toEqual([
			['e1', 'a1'],
			['e2', 'a2'],
		])
		expect([...context.refIds.deletedEntries]).toEqual([
			['e3', 'd1'],
			['e4', 'd2'],
		])
	})

	it('passes isEdited into the entry context', () => {
		expect(context.entries.map(({ ref, isEdited }) => ({ ref, isEdited }))).toEqual([
			{ ref: 'e1', isEdited: false },
			{ ref: 'e2', isEdited: true },
		])
	})

	it('tells the date of an entry of another day, not of today', () => {
		const { entries } = buildEditContext({
			active: [
				toEntry('a1'),
				toEntry('a2', { meal: { type: 'DINNER', localDate: new Date('2026-10-17T00:00:00Z') } }),
			],
			deleted: [],
			clarifications: [],
			today: '2026-10-18',
		})

		expect(entries.map(({ date }) => date)).toEqual([undefined, '2026-10-17'])
	})

	it('refs deleted entries in the deleted context too', () => {
		expect(context.deletedEntries.map(({ ref }) => ref)).toEqual(['e3', 'e4'])
	})
})

describe('buildEditContext valuesBefore', () => {
	it('gives an edited entry the values it held when logged, and nothing to the others', () => {
		const context = buildEditContext({
			active: [toEntry('a1', { isEdited: true }), toEntry('a2', { isEdited: true }), toEntry('a3')],
			deleted: [],
			clarifications: [],
			valuesBefore: new Map([
				['a1', { grams: 150, kcal: 120 }],
				['a3', { grams: 1 }],
			]),
			today: '2026-10-18',
		})

		expect(context.entries.map((entry) => entry.was)).toEqual([
			{ grams: 150, kcal: 120 },
			undefined,
			undefined,
		])
	})
})
