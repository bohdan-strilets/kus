import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import type { TodayEntryContext } from './edit-context.js'
import type { ParseRefs } from './entry-edits.js'
import { parseToolCalls, type RawToolCall } from './parse-tool-calls.js'
import { getAiFunctionTools } from './tools.js'

// A Latin "a" / "o" (0x61, 0x6f) inside Cyrillic words, built from code points so the test does
// not depend on how the glyphs survive copy-paste or a formatter.
const cp = (codes: string): string =>
	String.fromCodePoint(...codes.split(' ').map((code) => Number.parseInt(code, 16)))

const CHICKEN_BREAST_START = cp('43a 443 440 44f 447 430') + ' ' + cp('433 440 443 434 43a') // куряча грудк
const LATIN_NAME = CHICKEN_BREAST_START + cp('61') // ... with a Latin a
const FIXED_NAME = CHICKEN_BREAST_START + cp('430') // куряча грудка
const LATIN_OPTION_NAME = cp('411 6f 440 449') // Б + Latin o + рщ
const FIXED_OPTION_NAME = cp('411 43e 440 449') // Борщ

const borscht: TodayEntryContext = {
	ref: 'e1',
	name: 'Борщ червоний',
	mealType: 'LUNCH',
	grams: 350,
	kcal: 175,
	protein: 7,
	fat: 8,
	carbs: 19,
	fiber: null,
	category: 'borscht',
	source: 'ESTIMATE',
	isEdited: false,
}

const refs: ParseRefs = {
	memoryRefs: new Set(),
	entries: new Map([[borscht.ref, borscht]]),
	deletedEntryRefs: new Set(),
	clarifications: new Map(),
	today: '2026-10-07',
	measurementDays: new Set(),
}

const soup = {
	name: LATIN_NAME,
	grams: 300,
	quantity: null,
	kcal: 150,
	protein: 6,
	fat: 6,
	carbs: 18,
	fiber: 0,
	category: 'soup',
	source: 'ESTIMATE',
	isEdited: false,
	confidence: 0.4,
	assumption: null,
	memoryRef: null,
}

const option = (label: string, kcal: number, name: string | null) => ({
	label,
	kcal,
	protein: 0,
	fat: 0,
	carbs: kcal / 4,
	fiber: null,
	grams: null,
	name,
})

const call = (name: string, input: unknown): RawToolCall => ({
	name,
	arguments: JSON.stringify(input),
})

const logFood = (item: unknown): RawToolCall =>
	call('log_food', { items: [item], mealType: null, reply: 'Записав!' })

const clarifyWith = (names: [string | null, string | null]): RawToolCall =>
	call('clarify', {
		question: 'Що саме?',
		itemIndexes: [0],
		options: [option('A', 120, names[0]), option('B', 350, names[1])],
	})

describe('parseToolCalls name normalization', () => {
	it('fixes Latin look-alikes in log_food item names', () => {
		const result = parseToolCalls([logFood(soup)], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'log') return
		expect(result.decision.log.items[0]?.name).toBe(FIXED_NAME)
	})

	it('fixes clarify option names and keeps a null name null', () => {
		const result = parseToolCalls([logFood(soup), clarifyWith([LATIN_OPTION_NAME, null])], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'log') return
		const [clarification] = result.decision.clarifications
		expect(clarification?.options.map((item) => item.name)).toEqual([FIXED_OPTION_NAME, null])
	})

	it('fixes correct_entry change names and keeps a null name null', () => {
		const result = parseToolCalls(
			[
				call('correct_entry', { changes: [{ ref: 'e1', name: LATIN_OPTION_NAME }] }),
				call('reply', { text: 'Готово' }),
			],
			refs,
		)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'edit') return
		expect(result.decision.edits.corrections.map((item) => item.name)).toEqual([FIXED_OPTION_NAME])

		const withoutName = parseToolCalls(
			[
				call('correct_entry', { changes: [{ ref: 'e1', grams: 200 }] }),
				call('reply', { text: 'Ок' }),
			],
			refs,
		)
		expect(withoutName.ok).toBe(true)
		if (!withoutName.ok || withoutName.decision.kind !== 'edit') return
		expect(withoutName.decision.edits.corrections.map((item) => item.name)).toEqual([null])
	})

	it('leaves Latin-only brand names alone', () => {
		const result = parseToolCalls([logFood({ ...soup, name: 'Coca-Cola' })], refs)
		expect(result.ok).toBe(true)
		if (!result.ok || result.decision.kind !== 'log') return
		expect(result.decision.log.items[0]?.name).toBe('Coca-Cola')
	})

	it('keeps the raw model input in the stored call (AiToolCall.input)', () => {
		const result = parseToolCalls([logFood(soup)], refs)
		const stored = JSON.stringify(result.calls[0]?.input)
		expect(result.calls[0]?.status).toBe('SUCCEEDED')
		expect(stored).toContain(LATIN_NAME)
		expect(stored).not.toContain(FIXED_NAME)
	})
})

describe('AI tool JSON schemas', () => {
	// Name normalization runs after validation, so the schemas the model sees must not change with
	// it: a change here alters the model contract and needs an eval. The hash pins the current
	// schemas; update it only on purpose.
	it('are unchanged', () => {
		const hash = createHash('sha256').update(JSON.stringify(getAiFunctionTools())).digest('hex')
		expect(hash).toBe('f2a08f58f88994079ff0ed75eae2b692e3bfa7dc5ffe92163597918d742936ff')
	})
})
