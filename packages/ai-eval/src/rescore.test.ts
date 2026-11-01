import type { RawToolCall } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { summarize } from './metrics.js'
import { buildCaseContext } from './run-case.js'
import { rescoreResult, rescoreResults, RESCORE_NO_RAW_MESSAGE } from './rescore.js'
import { scoreAttempt } from './score-attempt.js'

const egg = {
	name: 'Яйце варене',
	grams: 150,
	quantity: 3,
	kcal: 233,
	protein: 19,
	fat: 16,
	carbs: 1.7,
	fiber: 0,
	category: 'eggs',
	source: 'REFERENCE',
	confidence: 0.9,
	assumption: null,
	memoryRef: null,
}

const logCall: RawToolCall = {
	name: 'log_food',
	arguments: JSON.stringify({ items: [egg], mealType: null, reply: 'Записав!' }),
}
const brokenCall: RawToolCall = { name: 'log_food', arguments: '{"items": [' }

const makeCase = (expectation: EvalCase['expect']): EvalCase => ({
	id: 'egg',
	text: '3 яйця',
	expect: expectation,
	reference: 'r',
})

const EXPECTED_233: EvalCase['expect'] = { decision: 'log', kcal: { exact: 233 } }
const EXPECTED_300: EvalCase['expect'] = { decision: 'log', kcal: { exact: 300 } }

const usage = {
	costUsd: 0.002,
	latencyMs: 900,
	inputTokens: 100,
	outputTokens: 50,
	cachedTokens: 10,
	textOnlyAnswers: 0,
}

/** What a live run would have saved: the result of scoring the answers, plus the raw answers. */
const savedResult = (evalCase: EvalCase, calls: RawToolCall[][]): CaseResult => {
	const rawAttempts = calls.map((toolCalls) => ({ toolCalls, text: null, isTruncated: false }))
	const last = calls.length
	const outcome = scoreAttempt({
		evalCase,
		context: buildCaseContext(evalCase),
		base: { caseId: evalCase.id, model: 'm' },
		usage,
		attempt: last,
		rawCalls: calls[last - 1] ?? [],
		validationErrors: [],
		rawAttempts,
	})
	if (!('result' in outcome)) throw new Error('fixture must parse')
	return outcome.result
}

describe('rescoreResult', () => {
	it('gives the same metrics as the original run', () => {
		const evalCase = makeCase(EXPECTED_233)
		const saved = savedResult(evalCase, [[logCall]])

		const again = rescoreResult(evalCase, saved)

		expect(again).toEqual(saved)
		expect(summarize('m', [{ evalCase, result: again }]).kcal.exact.meanPct).toBe(0)
	})

	it('changes the metric when the expectation changes', () => {
		const saved = savedResult(makeCase(EXPECTED_233), [[logCall]])
		const changed = makeCase(EXPECTED_300)

		const again = rescoreResult(changed, saved)

		expect(
			summarize('m', [{ evalCase: changed, result: again }]).kcal.exact.meanPct,
		).toBeGreaterThan(0)
	})

	it('replays a validation retry: the broken first answer is recorded, the second one counts', () => {
		const evalCase = makeCase(EXPECTED_233)
		const saved = savedResult(evalCase, [[brokenCall], [logCall]])

		const again = rescoreResult(evalCase, saved)

		expect(again.attempts).toBe(2)
		expect(again.wasRetried).toBe(true)
		expect(again.decision).toBe('log')
		expect(again.validationErrors).toHaveLength(1)
	})

	it('fails with INVALID_TOOL_CALLS when no saved answer parses', () => {
		const evalCase = makeCase(EXPECTED_233)
		const saved: CaseResult = {
			...savedResult(evalCase, [[logCall]]),
			rawAttempts: [
				{ toolCalls: [brokenCall], text: null, isTruncated: false },
				{ toolCalls: [brokenCall], text: null, isTruncated: false },
			],
		}

		const again = rescoreResult(evalCase, saved)

		expect(again.decision).toBe('error')
		expect(again.error).toBe('INVALID_TOOL_CALLS')
		expect(again.validationErrors).toHaveLength(2)
	})

	it('keeps a network error as it was and a truncated answer truncated', () => {
		const evalCase = makeCase(EXPECTED_233)
		const base = savedResult(evalCase, [[logCall]])
		const networkError = rescoreResult(evalCase, {
			...base,
			decision: 'error',
			error: 'timeout',
			attempts: 1,
			rawAttempts: [],
		})
		const truncated = rescoreResult(evalCase, {
			...base,
			rawAttempts: [{ toolCalls: [], text: null, isTruncated: true }],
		})

		expect(networkError.error).toBe('timeout')
		expect(truncated.truncated).toBe(true)
		expect(truncated.error).toBe('OUTPUT_TRUNCATED')
	})
})

describe('rescoreResults', () => {
	it('refuses results saved without raw calls', () => {
		const old = { ...savedResult(makeCase(EXPECTED_233), [[logCall]]), rawAttempts: undefined }

		expect(() => rescoreResults([old], [makeCase(EXPECTED_233)])).toThrow(RESCORE_NO_RAW_MESSAGE)
	})

	it('skips results whose case is gone and counts them, grouping by model', () => {
		const evalCase = makeCase(EXPECTED_233)
		const first = savedResult(evalCase, [[logCall]])
		const other = { ...first, model: 'm2' }
		const gone = { ...first, caseId: 'deleted-case' }

		const { runs, missingCases } = rescoreResults([first, other, gone], [evalCase])

		expect(missingCases).toBe(1)
		expect(runs.map((run) => run.model)).toEqual(['m', 'm2'])
		expect(runs[0]?.pairs).toHaveLength(1)
	})
})
