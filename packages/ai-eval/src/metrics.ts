import type { EvalCase, ExpectedValue } from './cases/index.js'
import type { ActualDecision, CaseResult, ErrorStats, ModelSummary } from './eval.types.js'

/** Floors for the % base, so 0.5 g of protein in an apple doesn't turn 1 g into a 100 % error. */
export const MIN_BASE = { kcal: 50, protein: 5 } as const

const PERCENT = 100
const P95 = 0.95

/** % error against the reference; for a range — 0 inside, else to the nearest bound. */
export const getErrorPct = (expected: ExpectedValue, actual: number, minBase: number): number => {
	if ('exact' in expected) {
		return (Math.abs(actual - expected.exact) / Math.max(expected.exact, minBase)) * PERCENT
	}
	if (actual >= expected.min && actual <= expected.max) return 0
	const bound = actual < expected.min ? expected.min : expected.max
	return (Math.abs(actual - bound) / Math.max(bound, minBase)) * PERCENT
}

export const isDecisionCorrect = (
	evalCase: EvalCase,
	actual: ActualDecision,
	replyText: string | null,
): boolean => {
	const expected = evalCase.expect.decision
	if (expected === 'log_or_clarify') return actual === 'log' || actual === 'clarify'
	if (expected !== actual) return false
	const mustInclude = evalCase.expect.replyIncludes ?? []
	return mustInclude.every((text) => (replyText ?? '').includes(text))
}

/** How many expected categories appear among the logged items (each item counts once). */
export const countCategoryMatches = (expected: string[], actual: string[]): number => {
	const pool = [...actual]
	let matches = 0
	for (const category of expected) {
		const index = pool.indexOf(category)
		if (index === -1) continue
		pool.splice(index, 1)
		matches += 1
	}
	return matches
}

const sortAscending = (values: number[]): number[] => [...values].sort((a, b) => a - b)

const getMedian = (values: number[]): number | null => {
	if (values.length === 0) return null
	const sorted = sortAscending(values)
	const middle = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 1) return sorted[middle] ?? null
	return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

const getPercentile = (values: number[], percentile: number): number => {
	const sorted = sortAscending(values)
	return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)] ?? 0
}

const getAverage = (values: number[]): number | null =>
	values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const toErrorStats = (errors: number[]): ErrorStats => ({
	count: errors.length,
	meanPct: getAverage(errors),
	medianPct: getMedian(errors),
})

interface Pair {
	evalCase: EvalCase
	result: CaseResult
}

const collectErrors = (
	pairs: Pair[],
	field: 'kcal' | 'protein',
	kind: 'exact' | 'range',
): number[] =>
	pairs.flatMap(({ evalCase, result }) => {
		const expected = evalCase.expect[field]
		const actual = result[field]
		if (!expected || actual === null) return []
		const isExact = 'exact' in expected
		if (isExact !== (kind === 'exact')) return []
		return [getErrorPct(expected, actual, MIN_BASE[field])]
	})

const getDecisionStats = (pairs: Pair[]): ModelSummary['decisions'] => {
	const byExpected: ModelSummary['decisions']['byExpected'] = {}
	let correct = 0
	for (const { evalCase, result } of pairs) {
		const bucket = (byExpected[evalCase.expect.decision] ??= { correct: 0, total: 0 })
		bucket.total += 1
		if (!isDecisionCorrect(evalCase, result.decision, result.replyText)) continue
		bucket.correct += 1
		correct += 1
	}
	return { correct, total: pairs.length, byExpected }
}

export const summarize = (model: string, pairs: Pair[]): ModelSummary => {
	const results = pairs.map(({ result }) => result)
	const totalCost = results.reduce((sum, result) => sum + result.costUsd, 0)
	return {
		model,
		cases: results.length,
		failed: results.filter((result) => result.decision === 'error').length,
		retried: results.filter((result) => result.wasRetried).length,
		truncated: results.filter((result) => result.truncated).length,
		kcal: {
			exact: toErrorStats(collectErrors(pairs, 'kcal', 'exact')),
			range: toErrorStats(collectErrors(pairs, 'kcal', 'range')),
		},
		protein: {
			exact: toErrorStats(collectErrors(pairs, 'protein', 'exact')),
			range: toErrorStats(collectErrors(pairs, 'protein', 'range')),
		},
		categories: {
			correct: pairs.reduce(
				(sum, { evalCase, result }) =>
					sum + countCategoryMatches(evalCase.expect.categories ?? [], result.categories),
				0,
			),
			total: pairs.reduce(
				(sum, { evalCase }) => sum + (evalCase.expect.categories?.length ?? 0),
				0,
			),
		},
		decisions: getDecisionStats(pairs),
		costUsd: { total: totalCost, perCase: getAverage(results.map((r) => r.costUsd)) ?? 0 },
		latencyMs: {
			p50: getMedian(results.map((r) => r.latencyMs)) ?? 0,
			p95: getPercentile(
				results.map((r) => r.latencyMs),
				P95,
			),
		},
		tokens: {
			inputPerCase: getAverage(results.map((r) => r.inputTokens)) ?? 0,
			outputPerCase: getAverage(results.map((r) => r.outputTokens)) ?? 0,
			cachedPerCase: getAverage(results.map((r) => r.cachedTokens)) ?? 0,
		},
		modelCalls: {
			total: results.reduce((sum, r) => sum + r.attempts, 0),
			textOnly: results.reduce((sum, r) => sum + r.textOnlyAnswers, 0),
		},
	}
}
