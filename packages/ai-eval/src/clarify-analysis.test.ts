import { describe, expect, it } from 'vitest'

import type { EvalCase } from './cases/index.js'
import { explainMissedClarify, isDecisionCorrectWithMemory } from './clarify-analysis.js'
import type { CaseResult, ClarifyCall, LoggedItem } from './eval.types.js'

const oatCookie = {
	ref: 'm1',
	name: 'Вівсяне печиво з родзинками',
	aliases: ['печиво'],
	per100g: { kcal: 430, protein: 6, fat: 16, carbs: 65 },
	pieceGrams: 15,
	defaultGrams: null,
	category: 'cookies' as const,
}

const evalCase = (text: string): EvalCase => ({
	id: 'c',
	text,
	expect: { decision: 'clarify', clarifyAbout: ['печив'] },
	reference: 'r',
	context: { memory: [oatCookie] },
})

const item = (memoryRef: string | null): LoggedItem => ({
	name: 'Печиво',
	mealType: null,
	grams: 45,
	quantity: 3,
	kcal: 194,
	protein: 2.7,
	source: memoryRef ? 'MEMORY' : 'ESTIMATE',
	memoryRef,
	assumption: null,
})

const result = (overrides: Partial<CaseResult>): CaseResult => ({
	caseId: 'c',
	model: 'm',
	decision: 'log',
	wasRetried: false,
	attempts: 1,
	error: null,
	kcal: 194,
	protein: 2.7,
	categories: [],
	replyText: null,
	edits: null,
	costUsd: 0,
	latencyMs: 0,
	inputTokens: 0,
	outputTokens: 0,
	cachedTokens: 0,
	textOnlyAnswers: 0,
	items: [],
	clarifyCalls: [],
	truncated: false,
	...overrides,
})

const lowImpactCall: ClarifyCall = {
	question: 'Яке печиво?',
	options: [
		{ label: 'Малі', kcal: 120, name: null },
		{ label: 'Великі', kcal: 170, name: null },
	],
	impactKcal: 50,
	kind: 'value',
	isKept: false,
}

describe('explainMissedClarify', () => {
	it('counts an item logged from a saved food, with no qualifier in the text, as covered', () => {
		const covered = result({ items: [item('m1')] })
		expect(explainMissedClarify(evalCase('чай, 3 печива'), covered)).toBe('memory_covered')
		expect(isDecisionCorrectWithMemory(evalCase('чай, 3 печива'), covered)).toBe(true)
	})

	it('does not count it when the text qualifies the item', () => {
		const covered = result({ items: [item('m1')] })
		expect(explainMissedClarify(evalCase('чай, 3 маленькі печива'), covered)).toBe('not_asked')
	})

	it('sees a qualifier across the comma and needs a known amount', () => {
		const covered = result({ items: [item('m1')] })
		expect(explainMissedClarify(evalCase('3 печива, але маленькі'), covered)).toBe('not_asked')
		expect(explainMissedClarify(evalCase("з'їв печиво"), covered)).toBe('not_asked')
	})

	it('tells a question dropped by the threshold from one never asked', () => {
		const asked = result({ items: [item(null)], clarifyCalls: [lowImpactCall] })
		expect(explainMissedClarify(evalCase('3 печива'), asked)).toBe('below_threshold')
		expect(explainMissedClarify(evalCase('3 печива'), result({ items: [item(null)] }))).toBe(
			'not_asked',
		)
	})

	it('has nothing to explain when the question was asked', () => {
		expect(explainMissedClarify(evalCase('3 печива'), result({ decision: 'clarify' }))).toBeNull()
	})
})
