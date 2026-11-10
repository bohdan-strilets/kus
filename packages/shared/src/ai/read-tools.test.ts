import { describe, expect, it } from 'vitest'

import { getParseRefs, mergeParseRefs } from './entry-edits.js'
import {
	isReadToolName,
	MAX_PARALLEL_READS,
	MAX_READ_STEPS,
	READ_TOOL_NAMES,
} from './read-tools.js'
import { AI_TOOL_NAMES } from './tools.js'
import type { FoodParseContext } from './context.js'

const context: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
	meals: [],
	entries: [],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-10-07', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
}

describe('read tool registry', () => {
	it('keeps limits that the loop and its deadline arithmetic rely on', () => {
		expect(MAX_READ_STEPS).toBe(2)
		expect(MAX_PARALLEL_READS).toBe(4)
	})

	it('never names a write tool', () => {
		for (const name of READ_TOOL_NAMES) {
			expect(Object.values(AI_TOOL_NAMES)).not.toContain(name)
		}
		expect(isReadToolName(AI_TOOL_NAMES.logFood)).toBe(false)
	})
})

describe('mergeParseRefs', () => {
	it('adds the refs a read handed out without changing the original', () => {
		const refs = getParseRefs(context)
		const merged = mergeParseRefs(refs, { memoryRefs: ['m11'], copyRefs: ['h6'] })

		expect(merged.memoryRefs.has('m11')).toBe(true)
		expect(merged.copyRefs?.has('h6')).toBe(true)
		expect(refs.memoryRefs.has('m11')).toBe(false)
		expect(merged.entries).toBe(refs.entries)
	})

	it('keeps the refs of the context and accepts an empty patch', () => {
		const refs = mergeParseRefs(getParseRefs(context), { memoryRefs: ['m1'] })
		const merged = mergeParseRefs(refs, {})

		expect([...merged.memoryRefs]).toEqual(['m1'])
		expect([...(merged.copyRefs ?? [])]).toEqual([])
	})
})
