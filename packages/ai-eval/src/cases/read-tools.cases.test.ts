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
	it('are the eighteen cases of stages 0.11.0 and 0.11.4, valid, with ids unique across the repo set', () => {
		expect(READ_TOOL_CASES).toHaveLength(18)
		const ids = REPO_CASES.map(({ id }) => id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const evalCase of READ_TOOL_CASES) {
			expect(evalCaseSchema.safeParse(evalCase).success, evalCase.id).toBe(true)
		}
	})

	it('give the memory-list cases three saved foods and two facts for the lookup to name', () => {
		for (const id of ['memory-list-all', 'memory-list-foods-only']) {
			const evalCase = byId(id)
			expect(evalCase.expect.findFoodCalled, id).toBe(true)
			expect(evalCase.savedFoods?.length, id).toBe(3)
			expect(buildCaseContext(evalCase).facts, id).toHaveLength(2)
		}
	})

	it('keep their history entries inside the 90 days find_food searches', () => {
		for (const evalCase of READ_TOOL_CASES) {
			for (const { date } of evalCase.historyEntries ?? []) {
				expect(date < '2026-10-07' && date >= '2026-07-09', `${evalCase.id} ${date}`).toBe(true)
			}
		}
	})

	it('keep tea out of the bar cases: the history hints at nothing but the bar', () => {
		for (const evalCase of READ_TOOL_CASES) {
			const texts = [
				evalCase.text,
				...(evalCase.context?.history ?? []).map(({ content }) => content),
			]
			expect(texts.join(' ').toLowerCase(), evalCase.id).not.toContain('чай')
		}
	})

	it('expect an honest estimate for a food that is nowhere, after a lookup', () => {
		const { expect: expected } = byId('read-no-match-honest')
		expect(expected).toMatchObject({
			decision: 'log_or_clarify',
			findFoodCalled: true,
			memoryRefs: [],
			copyRefs: [],
			sources: ['ESTIMATE', 'REFERENCE'],
		})
		expect(expected.replyExcludes).toContain('не можу додати')
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

	it('expect the e1 of today or a question, never the old h1, for «ще раз» a soup that is among today entries', () => {
		const soup = byId('read-again-soup-today')
		expect(soup.expect).toMatchObject({
			decision: 'log_or_reply',
			copyRefsAnyOf: [['e1'], []],
			findFoodCalled: false,
		})
		expect(soup.context?.entries?.[0]?.ref).toBe('e1')
		expect(soup.context?.earlier?.[0]?.ref).toBe('h1')
	})

	it('keep the app marker out of an unrelated answer', () => {
		const marker = byId('read-marker-not-in-unrelated-answer')
		expect(marker.context?.appChanges).toHaveLength(1)
		expect(marker.expect.replyExcludes).toEqual(['видален', 'в застосунку', 'прибран'])
	})
})
