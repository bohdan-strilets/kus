import { describe, expect, it } from 'vitest'

import { buildCaseContext } from '../run-case.js'
import { evalCaseSchema } from './case.types.js'
import { REPO_CASES } from './index.js'
import { READ_TOOL_CASES } from './read-tools.cases.js'

const byId = (id: string) => {
	const found = READ_TOOL_CASES.find((item) => item.id === id)
	if (!found) throw new Error(`no case ${id}`)
	return found
}

const passiveNames = (id: string): string[] =>
	buildCaseContext(byId(id)).memory.map(({ name }) => name)

describe('read-tool cases', () => {
	it('are the twelve cases of stage 0.11.0, valid, with ids unique across the repo set', () => {
		expect(READ_TOOL_CASES).toHaveLength(12)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of READ_TOOL_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('keep their history entries inside the 90 days find_food searches', () => {
		for (const evalCase of READ_TOOL_CASES) {
			for (const { date } of evalCase.historyEntries ?? []) {
				expect(date < '2026-10-07' && date >= '2026-07-09', `${evalCase.id} ${date}`).toBe(true)
			}
		}
	})

	it('start from a passive block that matches the point of the case', () => {
		// found by the block itself: no lookup is needed
		expect(passiveNames('read-sportyfeel-exact')).toEqual(['Батончик SportyFeel'])
		expect(passiveNames('read-translit-cyr')).toEqual(['Батончик SportyFeel'])
		expect(passiveNames('read-typo-i')).toEqual(['Протеїновий батончик SportyFeel'])
		// no food word in the message («Він має іншу назву, пошукай», #73): only find_food can find the bar
		expect(passiveNames('read-prot-bar-abbrev')).toEqual([])
		// a lookup of the history, nothing saved matches
		expect(passiveNames('read-last-protein-bar')).toEqual([])
		expect(passiveNames('read-last-time-170')).toEqual([])
		expect(passiveNames('read-no-match-honest')).toEqual([])
		expect(passiveNames('read-plain-banana-no-find')).toEqual([])
	})
})
