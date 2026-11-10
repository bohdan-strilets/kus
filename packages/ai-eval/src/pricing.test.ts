import { describe, expect, it } from 'vitest'

import { READ_TOOL_CASES } from './cases/read-tools.cases.js'
import {
	CACHE_READ_RATIO,
	CACHE_WRITE_RATIO,
	estimateInputParts,
	getCaseReserveUsd,
	getCaseUpperBoundUsd,
	MAX_MODEL_CALLS_PER_CASE,
	type ModelPrice,
} from './pricing.js'

/** Claude Sonnet 5.5 on OpenRouter: $2 in, $10 out per million. */
const PRICE: ModelPrice = { prompt: 2e-6, completion: 10e-6 }

/** Billed cost of the 2026-11-10 read-tools run (results/2026-11-10T11-57-11-981Z.jsonl). */
const ACTUAL_USD: Record<string, number> = {
	'read-prot-bar-abbrev': 0.0632,
	'read-sportyfeel-exact': 0.0604,
	'read-translit-cyr': 0.0563,
	'read-show-memory-list': 0.0557,
	'read-last-protein-bar': 0.0182,
	'read-last-time-170': 0.013,
	'read-copy-today-to-tomorrow': 0.0122,
	'read-no-match-honest': 0.0107,
	'read-deleted-by-user-not-mine': 0.0087,
	'read-typo-i': 0.0058,
	'read-restored-by-kusik': 0.0057,
	'read-plain-banana-no-find': 0.0053,
}

describe('cache prices of the 2026-11-10 run', () => {
	it('bill a cold prefix at 1.25× the prompt price and a cached one at 0.05×', () => {
		// read-sportyfeel-exact: 21 452 input tokens, none cached, 675 output
		const cold = 21_452 * PRICE.prompt * CACHE_WRITE_RATIO + 675 * PRICE.completion
		expect(cold).toBeCloseTo(ACTUAL_USD['read-sportyfeel-exact'] ?? 0, 3)
		// read-typo-i: 21 399 input, 21 030 of them cached, 278 output
		const warm =
			369 * PRICE.prompt * CACHE_WRITE_RATIO +
			21_030 * PRICE.prompt * CACHE_READ_RATIO +
			278 * PRICE.completion
		expect(warm).toBeCloseTo(ACTUAL_USD['read-typo-i'] ?? 0, 3)
	})
})

describe('case reserve upper bound', () => {
	it('counts the read rounds and the retry as model calls', () => {
		expect(MAX_MODEL_CALLS_PER_CASE).toBe(4)
	})

	it('estimates the cached prefix of about 21k tokens, within 20 % of the real one', () => {
		for (const evalCase of READ_TOOL_CASES) {
			const { prefix } = estimateInputParts(evalCase)
			expect(prefix, evalCase.id).toBeGreaterThan(21_000 * 0.8)
			expect(prefix, evalCase.id).toBeLessThan(21_000 * 1.2)
		}
	})

	it('covers the real cost of every case of the last run, the most expensive ones included', () => {
		for (const evalCase of READ_TOOL_CASES) {
			const actual = ACTUAL_USD[evalCase.id]
			expect(actual, evalCase.id).toBeDefined()
			expect(getCaseUpperBoundUsd(evalCase, PRICE, 'low'), evalCase.id).toBeGreaterThanOrEqual(
				actual ?? Infinity,
			)
		}
		expect(getCaseReserveUsd(READ_TOOL_CASES, PRICE, 'low')).toBeGreaterThanOrEqual(0.0632)
	})
})
