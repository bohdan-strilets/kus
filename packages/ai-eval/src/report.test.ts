import { describe, expect, it } from 'vitest'

import type { EvalCase } from './cases/index.js'
import { EMPTY_CALL_FACTS } from './call-facts.js'
import type { CaseResult } from './eval.types.js'
import { formatMisses, formatMixedScript, formatValidationRetries } from './report.js'

const evalCase = { id: 'case-1', text: 'x', expect: { decision: 'log' } } as EvalCase

const result = (overrides: Partial<CaseResult>): CaseResult => ({
	caseId: 'case-1',
	model: 'm',
	decision: 'log',
	wasRetried: false,
	attempts: 1,
	error: null,
	kcal: null,
	protein: null,
	categories: [],
	replyText: null,
	edits: null,
	measurements: [],
	workouts: [],
	calls: EMPTY_CALL_FACTS,
	costUsd: 0,
	latencyMs: 0,
	inputTokens: 0,
	outputTokens: 0,
	cachedTokens: 0,
	textOnlyAnswers: 0,
	items: [],
	clarifyCalls: [],
	truncated: false,
	validationErrors: [],
	mixedScriptWords: [],
	...overrides,
})

describe('formatMisses', () => {
	it('shows the first validation error and the last tools for INVALID_TOOL_CALLS', () => {
		const failed = result({
			decision: 'error',
			error: 'INVALID_TOOL_CALLS',
			attempts: 2,
			validationErrors: [
				{ attempt: 1, callNames: ['log_food'], errors: ['log_food: items.0.grams too large'] },
				{ attempt: 2, callNames: ['log_measurement'], errors: ['no reply'] },
			],
		})
		const text = formatMisses([{ evalCase, result: failed }])
		expect(text).toContain('no reply')
		expect(text).toContain('інструменти: log_measurement')
	})
})

describe('formatValidationRetries', () => {
	it('lists a case whose retry succeeded and truncates long errors', () => {
		const retried = result({
			wasRetried: true,
			attempts: 2,
			validationErrors: [{ attempt: 1, callNames: ['log_measurement'], errors: ['e'.repeat(300)] }],
		})
		const text = formatValidationRetries([{ evalCase, result: retried }])
		expect(text).toContain('case-1: повтор вдався')
		expect(text).toContain('log_measurement')
		expect(text.length).toBeLessThan(250)
	})

	it('is empty when nothing failed validation', () => {
		expect(formatValidationRetries([{ evalCase, result: result({}) }])).toBe('')
	})
})

describe('formatMixedScript', () => {
	it('counts cases and lists the words', () => {
		const text = formatMixedScript([
			{ evalCase, result: result({ mixedScriptWords: ['курячa'] }) },
			{ evalCase: { ...evalCase, id: 'case-2' }, result: result({}) },
		])
		expect(text).toContain('1 кейсів')
		expect(text).toContain('case-1: курячa')
	})
})
