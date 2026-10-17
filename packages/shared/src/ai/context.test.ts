import { describe, expect, it } from 'vitest'

import {
	buildFoodParseMessages,
	formatContext,
	type FoodParseContext,
	formatMeasurements,
	HISTORY_MESSAGE_MAX_CHARS,
	type HistoryTurn,
	PHOTO_HISTORY_MARKER,
	selectHistory,
} from './context.js'
import type { TodayEntryContext } from './edit-context.js'

describe('formatMeasurements', () => {
	it('lists the last weights, the waist and the target', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [
					{ value: 82.8, localDate: '2026-10-05' },
					{ value: 83.1, localDate: '2026-09-29' },
				],
				waist: { value: 94, localDate: '2026-10-01' },
				targetWeightKg: 78,
			}),
		).toBe(
			'Weight: 82.8 kg on 2026-10-05; 83.1 kg on 2026-09-29. Waist: 94 cm on 2026-10-01. Target weight: 78 kg.',
		)
	})

	it('says so when nothing is logged and skips the missing parts', () => {
		expect(
			formatMeasurements({ today: '2026-10-07', weights: [], waist: null, targetWeightKg: null }),
		).toBe('Weight: none logged.')
	})
})

describe('formatMeasurements parts', () => {
	it('shows the waist and the target even without any weight', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [],
				waist: { value: 94, localDate: '2026-10-01' },
				targetWeightKg: 78,
			}),
		).toBe('Weight: none logged. Waist: 94 cm on 2026-10-01. Target weight: 78 kg.')
	})

	it('skips the waist and the target when a weight is all there is', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [{ value: 82, localDate: '2026-10-06' }],
				waist: null,
				targetWeightKg: null,
			}),
		).toBe('Weight: 82 kg on 2026-10-06.')
	})
})

const baseEntry: TodayEntryContext = {
	ref: 'e1',
	name: 'Вівсянка',
	mealType: 'BREAKFAST',
	grams: 300,
	kcal: 420,
	protein: 20,
	fat: 15,
	carbs: 50,
	fiber: null,
	category: 'porridge',
	source: 'ESTIMATE',
	isEdited: false,
}

const baseContext: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 420, protein: 20, fat: 15, carbs: 50 },
	meals: [{ type: 'BREAKFAST', kcal: 420 }],
	entries: [baseEntry],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-10-07', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
}

const CHANGED_MARKER = '(changed after logging)'

describe('formatContext entries', () => {
	it('marks an entry edited after logging', () => {
		const text = formatContext({ ...baseContext, entries: [{ ...baseEntry, isEdited: true }] })
		expect(text).toContain(CHANGED_MARKER)
		expect(text).toMatch(/- e1 BREAKFAST .*\(changed after logging\)/)
	})

	it('does not mark an untouched entry', () => {
		expect(formatContext(baseContext)).not.toContain(CHANGED_MARKER)
	})

	it('marks only the edited entry among several', () => {
		const text = formatContext({
			...baseContext,
			entries: [baseEntry, { ...baseEntry, ref: 'e2', isEdited: true }],
		})
		const lines = text.split('\n')
		expect(lines.find((line) => line.startsWith('- e1 '))).not.toContain(CHANGED_MARKER)
		expect(lines.find((line) => line.startsWith('- e2 '))).toContain(CHANGED_MARKER)
	})

	it('says the listed entries are already logged with their current values', () => {
		expect(formatContext(baseContext)).toContain(
			"Today's entries — already logged, current values (refs for correct_entry / delete_entry; only these can be changed):",
		)
	})

	it('reaches the model through buildFoodParseMessages', () => {
		const messages = buildFoodParseMessages(
			{ ...baseContext, entries: [{ ...baseEntry, isEdited: true }] },
			'ще чай',
		)
		expect(JSON.stringify(messages[1])).toContain(CHANGED_MARKER)
	})
})

describe('history turns with logged entries', () => {
	const userTurn = (overrides: Partial<HistoryTurn>): HistoryTurn => ({
		role: 'user',
		content: 'вівсянка 300 г',
		...overrides,
	})

	it('starts the user turn with the logged refs marker', () => {
		const [turn] = selectHistory([userTurn({ loggedRefs: ['e1', 'e2'] })])
		expect(turn?.content).toBe('[logged: e1, e2] вівсянка 300 г')
	})

	it('keeps the marker when the long text is cut', () => {
		const long = 'x'.repeat(HISTORY_MESSAGE_MAX_CHARS * 2)
		const [turn] = selectHistory([userTurn({ content: long, loggedRefs: ['e1', 'e2'] })])
		expect(turn?.content.startsWith('[logged: e1, e2] ')).toBe(true)
		expect(turn?.content).toHaveLength(HISTORY_MESSAGE_MAX_CHARS)
	})

	it('keeps both the logged marker and the photo marker', () => {
		const [turn] = selectHistory([userTurn({ hasPhoto: true, loggedRefs: ['e1'] })])
		expect(turn?.content.startsWith('[logged: e1] ')).toBe(true)
		expect(turn?.content).toContain(PHOTO_HISTORY_MARKER)
		expect(turn?.content).toContain('вівсянка 300 г')
	})

	it('adds no marker without logged refs', () => {
		const [plain, empty] = selectHistory([userTurn({}), userTurn({ loggedRefs: [] })])
		expect(plain?.content).toBe('вівсянка 300 г')
		expect(empty?.content).toBe('вівсянка 300 г')
	})

	it('marks a turn that logged entries without refs as just logged', () => {
		const [turn] = selectHistory([userTurn({ hasLoggedEntries: true })])
		expect(turn?.content).toBe('[logged] вівсянка 300 г')
	})

	it('prefers the refs over the bare flag', () => {
		const [turn] = selectHistory([userTurn({ hasLoggedEntries: true, loggedRefs: ['e2'] })])
		expect(turn?.content).toBe('[logged: e2] вівсянка 300 г')
	})

	it('keeps the bare marker when the long text is cut', () => {
		const long = 'x'.repeat(HISTORY_MESSAGE_MAX_CHARS * 2)
		const [turn] = selectHistory([userTurn({ content: long, hasLoggedEntries: true })])
		expect(turn?.content.startsWith('[logged] ')).toBe(true)
		expect(turn?.content).toHaveLength(HISTORY_MESSAGE_MAX_CHARS)
	})

	it('never marks an assistant turn with the bare flag', () => {
		const [turn] = selectHistory([
			{ role: 'assistant', content: 'Записано', hasLoggedEntries: true },
		])
		expect(turn?.content).toBe('Записано')
	})

	it('never marks an assistant turn', () => {
		const [turn] = selectHistory([{ role: 'assistant', content: 'Записано', loggedRefs: ['e1'] }])
		expect(turn?.content).toBe('Записано')
	})
})
