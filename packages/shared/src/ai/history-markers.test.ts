import { describe, expect, it } from 'vitest'

import { HISTORY_MESSAGE_MAX_CHARS, selectHistory } from './context.js'
import {
	formatAppChangeMarkers,
	formatHistoryMarkers,
	formatKusikMarkers,
	type HistoryMarkerFields,
} from './history-markers.js'

const render = (
	fields: HistoryMarkerFields & { hasPhoto?: boolean },
	content = 'текст',
): string => {
	const [turn] = selectHistory([{ role: 'user', content, ...fields }])
	return turn?.content ?? ''
}

describe('food markers', () => {
	it('lists the logged refs', () => {
		expect(formatHistoryMarkers({ loggedRefs: ['e1', 'e2'] })).toEqual(['[logged: e1, e2]'])
	})

	it('names the refs deleted later', () => {
		expect(formatHistoryMarkers({ loggedRefs: ['e1', 'e2'], deletedLoggedRefs: ['e2'] })).toEqual([
			'[logged: e1, e2; deleted later: e2]',
		])
	})

	it('names all the refs when all were deleted', () => {
		expect(formatHistoryMarkers({ loggedRefs: ['e1'], deletedLoggedRefs: ['e1'] })).toEqual([
			'[logged: e1; deleted later: e1]',
		])
	})

	it('says logged without refs, and deleted later when all of them are', () => {
		expect(formatHistoryMarkers({ hasLoggedEntries: true })).toEqual(['[logged]'])
		expect(formatHistoryMarkers({ hasLoggedEntries: true, areLoggedEntriesDeleted: true })).toEqual(
			['[logged; deleted later]'],
		)
	})
})

describe('workout markers', () => {
	it('shows the ref and the deleted state', () => {
		expect(
			formatHistoryMarkers({ workout: { refs: ['w1'], deletedRefs: [], isDeleted: false } }),
		).toEqual(['[workout logged: w1]'])
		expect(
			formatHistoryMarkers({ workout: { refs: ['w1'], deletedRefs: ['w1'], isDeleted: true } }),
		).toEqual(['[workout logged: w1; deleted later: w1]'])
	})

	it('has no ref when the workout is not in the context', () => {
		expect(
			formatHistoryMarkers({ workout: { refs: [], deletedRefs: [], isDeleted: false } }),
		).toEqual(['[workout logged]'])
		expect(
			formatHistoryMarkers({ workout: { refs: [], deletedRefs: [], isDeleted: true } }),
		).toEqual(['[workout logged; deleted later]'])
	})
})

describe('measurement markers', () => {
	it('names the kind and the deleted state', () => {
		expect(
			formatHistoryMarkers({
				measurements: [
					{ kind: 'weight', isDeleted: false },
					{ kind: 'waist', isDeleted: true },
				],
			}),
		).toEqual(['[weight logged]', '[waist logged; deleted later]'])
		expect(formatHistoryMarkers({ measurements: [{ kind: 'weight', isDeleted: true }] })).toEqual([
			'[weight logged; deleted later]',
		])
		expect(formatHistoryMarkers({ measurements: [{ kind: 'waist', isDeleted: false }] })).toEqual([
			'[waist logged]',
		])
	})
})

describe('fact markers', () => {
	it('shows a saved fact with its current ref, or without one', () => {
		expect(
			formatHistoryMarkers({ facts: [{ kind: 'saved', ref: 'f11', isDeleted: false }] }),
		).toEqual(['[fact saved: f11]'])
		expect(
			formatHistoryMarkers({ facts: [{ kind: 'saved', ref: null, isDeleted: false }] }),
		).toEqual(['[fact saved]'])
	})

	it('drops the ref of a deleted fact', () => {
		expect(
			formatHistoryMarkers({ facts: [{ kind: 'saved', ref: null, isDeleted: true }] }),
		).toEqual(['[fact saved; deleted later]'])
	})

	it('tells a proposal without an answer, and a declined one', () => {
		expect(formatHistoryMarkers({ facts: [{ kind: 'proposed', isDeclined: false }] })).toEqual([
			'[fact proposed]',
		])
		expect(formatHistoryMarkers({ facts: [{ kind: 'proposed', isDeclined: true }] })).toEqual([
			'[fact proposed; declined]',
		])
	})

	it('marks every forgotten fact', () => {
		expect(formatHistoryMarkers({ facts: [{ kind: 'forgotten' }, { kind: 'forgotten' }] })).toEqual(
			['[fact forgotten]', '[fact forgotten]'],
		)
	})

	it('merges one forgotten and one saved fact into an update', () => {
		expect(
			formatHistoryMarkers({
				facts: [{ kind: 'forgotten' }, { kind: 'saved', ref: 'f11', isDeleted: false }],
			}),
		).toEqual(['[fact updated: f11]'])
		expect(
			formatHistoryMarkers({
				facts: [{ kind: 'saved', ref: null, isDeleted: true }, { kind: 'forgotten' }],
			}),
		).toEqual(['[fact updated; deleted later]'])
	})

	it('does not merge two forgotten, two saved, or a proposal instead of a save', () => {
		expect(
			formatHistoryMarkers({
				facts: [
					{ kind: 'forgotten' },
					{ kind: 'forgotten' },
					{ kind: 'saved', ref: 'f2', isDeleted: false },
				],
			}),
		).toEqual(['[fact forgotten]', '[fact forgotten]', '[fact saved: f2]'])
		expect(
			formatHistoryMarkers({
				facts: [
					{ kind: 'forgotten' },
					{ kind: 'saved', ref: 'f2', isDeleted: false },
					{ kind: 'saved', ref: 'f3', isDeleted: false },
				],
			}),
		).toEqual(['[fact forgotten]', '[fact saved: f2]', '[fact saved: f3]'])
		expect(
			formatHistoryMarkers({
				facts: [{ kind: 'forgotten' }, { kind: 'proposed', isDeclined: false }],
			}),
		).toEqual(['[fact forgotten]', '[fact proposed]'])
	})

	it('puts the forgotten before the saved, whatever the input order', () => {
		expect(
			formatHistoryMarkers({
				facts: [
					{ kind: 'saved', ref: 'f2', isDeleted: false },
					{ kind: 'forgotten' },
					{ kind: 'forgotten' },
				],
			}),
		).toEqual(['[fact forgotten]', '[fact forgotten]', '[fact saved: f2]'])
	})
})

describe('saved food markers', () => {
	it('shows the m-ref when there is one', () => {
		expect(formatHistoryMarkers({ savedFoods: [{ ref: 'm3', isDeleted: false }] })).toEqual([
			'[food saved: m3]',
		])
		expect(formatHistoryMarkers({ savedFoods: [{ ref: null, isDeleted: false }] })).toEqual([
			'[food saved]',
		])
	})

	it('says deleted later without the ref', () => {
		expect(formatHistoryMarkers({ savedFoods: [{ ref: 'm3', isDeleted: true }] })).toEqual([
			'[food saved; deleted later]',
		])
	})
})

describe('history text', () => {
	it('puts the kinds in the fixed order, before the text', () => {
		expect(
			render({
				loggedRefs: ['e1', 'e2'],
				deletedLoggedRefs: ['e2'],
				workout: { refs: ['w1'], deletedRefs: [], isDeleted: false },
				measurements: [{ kind: 'weight', isDeleted: true }],
				facts: [{ kind: 'saved', ref: 'f3', isDeleted: false }],
				savedFoods: [{ ref: 'm3', isDeleted: false }],
			}),
		).toBe(
			'[logged: e1, e2; deleted later: e2] [workout logged: w1] [weight logged; deleted later] [fact saved: f3] [food saved: m3] текст',
		)
	})

	it('matches the examples of the brief', () => {
		expect(
			render(
				{
					loggedRefs: ['e1', 'e2'],
					deletedLoggedRefs: ['e2'],
					facts: [{ kind: 'saved', ref: 'f3', isDeleted: false }],
				},
				"вівсянка і банан, і запам'ятай, що не п'ю каву",
			),
		).toBe(
			"[logged: e1, e2; deleted later: e2] [fact saved: f3] вівсянка і банан, і запам'ятай, що не п'ю каву",
		)
		expect(
			render(
				{
					workout: { refs: ['w1'], deletedRefs: [], isDeleted: false },
					measurements: [{ kind: 'weight', isDeleted: true }],
				},
				'жим 80×8, вага 82',
			),
		).toBe('[workout logged: w1] [weight logged; deleted later] жим 80×8, вага 82')
		expect(
			render(
				{
					hasPhoto: true,
					facts: [{ kind: 'forgotten' }, { kind: 'saved', ref: 'f11', isDeleted: false }],
				},
				'ось новий графік',
			),
		).toBe('[fact updated: f11] [фото] ось новий графік')
	})

	it('keeps all the markers when a long message is cut', () => {
		const long = 'x'.repeat(HISTORY_MESSAGE_MAX_CHARS * 2)
		const text = render(
			{
				loggedRefs: ['e1'],
				workout: { refs: [], deletedRefs: [], isDeleted: false },
				facts: [{ kind: 'forgotten' }],
			},
			long,
		)
		expect(text.startsWith('[logged: e1] [workout logged] [fact forgotten] ')).toBe(true)
		expect(text).toHaveLength(HISTORY_MESSAGE_MAX_CHARS)
	})

	it('gives an assistant turn no markers', () => {
		const [turn] = selectHistory([
			{
				role: 'assistant',
				content: 'Записано',
				workout: { refs: ['w1'], deletedRefs: [], isDeleted: false },
				facts: [{ kind: 'forgotten' }],
				measurements: [{ kind: 'weight', isDeleted: false }],
				savedFoods: [{ ref: 'm1', isDeleted: false }],
			},
		])
		expect(turn?.content).toBe('Записано')
	})

	it('adds nothing for a turn without markers', () => {
		expect(render({})).toBe('текст')
	})
})

describe('who deleted a logged entry', () => {
	it('names Kusik and the app, and leaves the unknown ones plain', () => {
		expect(
			formatHistoryMarkers({
				loggedRefs: ['e1', 'e2', 'e3'],
				deletedLoggedRefs: ['e1', 'e2', 'e3'],
				deletedByKusikLoggedRefs: ['e1'],
				deletedInAppLoggedRefs: ['e2'],
			}),
		).toEqual([
			'[logged: e1, e2, e3; deleted later by Kusik: e1; deleted later in the app: e2; deleted later: e3]',
		])
	})

	it('says it for a single author without repeating the plain form', () => {
		expect(
			formatHistoryMarkers({
				loggedRefs: ['e1'],
				deletedLoggedRefs: ['e1'],
				deletedInAppLoggedRefs: ['e1'],
			}),
		).toEqual(['[logged: e1; deleted later in the app: e1]'])
	})

	it('names the author without refs', () => {
		expect(
			formatHistoryMarkers({
				hasLoggedEntries: true,
				areLoggedEntriesDeleted: true,
				loggedDeletedBy: 'kusik',
			}),
		).toEqual(['[logged; deleted later by Kusik]'])
		expect(
			formatHistoryMarkers({
				hasLoggedEntries: true,
				areLoggedEntriesDeleted: true,
				loggedDeletedBy: 'app',
			}),
		).toEqual(['[logged; deleted later in the app]'])
	})
})

describe('Kusik action markers', () => {
	const none = { deleted: [], restored: [], corrected: [] }

	it('lists deleted, restored and corrected entries in a fixed order', () => {
		expect(
			formatKusikMarkers({
				kusikActions: {
					deleted: [{ ref: 'e13' }],
					restored: [{ ref: 'e16' }],
					corrected: [{ ref: 'e7', grams: 45 }],
				},
			}),
		).toEqual(['[Kusik: deleted e13; restored e16; corrected e7 → 45 g]'])
	})

	it('skips the kinds without actions and says nothing without any', () => {
		expect(formatKusikMarkers({ kusikActions: { ...none, restored: [{ ref: 'e2' }] } })).toEqual([
			'[Kusik: restored e2]',
		])
		expect(formatKusikMarkers({ kusikActions: none })).toEqual([])
		expect(formatKusikMarkers({})).toEqual([])
	})

	it('drops entries without a ref, but keeps the kind when none has one', () => {
		expect(
			formatKusikMarkers({ kusikActions: { ...none, deleted: [{ ref: null }, { ref: 'e4' }] } }),
		).toEqual(['[Kusik: deleted e4]'])
		expect(formatKusikMarkers({ kusikActions: { ...none, deleted: [{ ref: null }] } })).toEqual([
			'[Kusik: deleted]',
		])
	})

	it('cuts a long list', () => {
		const deleted = Array.from({ length: 9 }, (_, index) => ({ ref: `e${index + 1}` }))
		expect(formatKusikMarkers({ kusikActions: { ...none, deleted } })).toEqual([
			'[Kusik: deleted e1, e2, e3, e4, e5, e6 +3]',
		])
	})

	it('goes in front of Kusik reply and survives a cut, user turns never get it', () => {
		const kusikActions = { ...none, deleted: [{ ref: 'e1' }] }
		const [reply] = selectHistory([{ role: 'assistant', content: 'Видалив', kusikActions }])
		expect(reply?.content).toBe('[Kusik: deleted e1] Видалив')
		const [user] = selectHistory([{ role: 'user', content: 'ок', kusikActions }])
		expect(user?.content).toBe('ок')
	})
})

describe('changes made in the app', () => {
	it('shows the kind, ref, name and date', () => {
		expect(
			formatHistoryMarkers({
				appChanges: [
					{ kind: 'deleted', ref: 'e9', name: 'Святкове застілля', localDate: '2026-11-04' },
					{ kind: 'edited', ref: null, name: 'Гречка', localDate: '2026-11-05' },
				],
			}),
		).toEqual([
			'[in the app before this message: deleted e9 "Святкове застілля" (04.11), edited "Гречка" (05.11)]',
		])
	})

	it('shortens a long name and cannot be broken out of by quotes', () => {
		const [marker] = formatAppChangeMarkers([
			{ kind: 'deleted', ref: 'e1', name: `"${'а'.repeat(50)}"`, localDate: '2026-11-04' },
		])
		expect(marker).toBe(
			`[in the app before this message: deleted e1 "'${'а'.repeat(28)}…" (04.11)]`,
		)
	})

	it('keeps only the newest five', () => {
		const changes = Array.from({ length: 7 }, (_, index) => ({
			kind: 'deleted' as const,
			ref: `e${index + 1}`,
			name: 'х',
			localDate: '2026-11-04',
		}))
		const [marker] = formatAppChangeMarkers(changes)
		expect(marker).not.toContain('e2 ')
		expect(marker).toContain('e3 ')
		expect(marker).toContain('e7 ')
	})

	it('goes first in a user turn and in front of the current message', () => {
		const appChanges = [
			{ kind: 'deleted' as const, ref: 'e1', name: 'Борщ', localDate: '2026-11-04' },
		]
		const marker = '[in the app before this message: deleted e1 "Борщ" (04.11)]'
		expect(render({ appChanges, loggedRefs: ['e2'] })).toBe(`${marker} [logged: e2] текст`)
		expect(formatAppChangeMarkers([])).toEqual([])
	})
})
