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
		meal: { type: 'LUNCH' },
		...overrides,
	}) as unknown as Active[number]

describe('buildEditContext', () => {
	const context = buildEditContext({
		active: [toEntry('a1'), toEntry('a2', { isEdited: true })],
		deleted: [toEntry('d1'), toEntry('d2')],
		clarifications: [],
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

	it('refs deleted entries in the deleted context too', () => {
		expect(context.deletedEntries.map(({ ref }) => ref)).toEqual(['e3', 'e4'])
	})
})
