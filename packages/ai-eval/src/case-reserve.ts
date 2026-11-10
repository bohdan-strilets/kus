import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { CaseResult } from './eval.types.js'
import { loadResultsFile } from './results-store.js'

/** The reserve never drops below this, however cheap the history looks. */
export const MIN_CASE_RESERVE_USD = 0.02
/**
 * A case that meets the prompt prefix cold writes it (21k tokens at $2.5/M ≈ $0.054) and may still
 * make read rounds on top (measured $0.056–0.064 with up to one); later ones read the cache.
 */
export const COLD_START_RESERVE_USD = 0.09
/** A case may be retried once, so its reserve covers both attempts. */
export const RESERVE_ATTEMPTS = 2
const RESERVE_PERCENTILE = 0.95

/** One earlier case result: its cost and whether it read the prompt cache (a cold one wrote it instead). */
export interface CostSample {
	costUsd: number
	isWarm: boolean
}

/** Real per-case costs of earlier runs, by model and case id (failed results without a cost are not kept). */
export type CostHistory = Map<string, Map<string, CostSample[]>>

export const addToHistory = (history: CostHistory, results: CaseResult[]): void => {
	for (const { model, caseId, costUsd, cachedTokens } of results) {
		if (!(costUsd > 0)) continue
		const byCase = history.get(model) ?? new Map<string, CostSample[]>()
		const sample: CostSample = { costUsd, isWarm: cachedTokens > 0 }
		byCase.set(caseId, [...(byCase.get(caseId) ?? []), sample])
		history.set(model, byCase)
	}
}

const isWarm = (sample: CostSample): boolean => sample.isWarm

/** Nearest-rank percentile; 0 for an empty list. */
export const getPercentile = (values: number[], fraction: number): number => {
	if (values.length === 0) return 0
	const sorted = [...values].sort((a, b) => a - b)
	const rank = Math.max(1, Math.ceil(fraction * sorted.length))
	return sorted[rank - 1] ?? 0
}

/**
 * p95 of the cases' own history, else of all history of the model; null when the model has none,
 * so the caller falls back to the price-based upper bound. Warm samples (cache read) are preferred:
 * cold ones (≈ $0.06 each, they write the prefix) would inflate the reserve of every later case
 * ~8× (≈ $0.096 vs a real $0.0065–0.01), while the cold cost is already covered separately by
 * COLD_START_RESERVE_USD for the first `concurrency` cases. Without any warm sample the cold ones
 * are used, as before.
 */
export const getHistoricalP95Usd = (
	history: CostHistory,
	model: string,
	caseIds: string[],
): number | null => {
	const byCase = history.get(model)
	if (!byCase) return null
	const own = caseIds.flatMap((id) => byCase.get(id) ?? [])
	const all = [...byCase.values()].flat()
	const candidates = [own.filter(isWarm), all.filter(isWarm), own, all]
	const samples = candidates.find((list) => list.length > 0) ?? []
	const costs = samples.map((sample) => sample.costUsd)
	return costs.length > 0 ? getPercentile(costs, RESERVE_PERCENTILE) : null
}

/** p95 of one case's own history (warm samples first); null when it has none. */
const getHistoricalOwnP95Usd = (
	history: CostHistory,
	model: string,
	caseId: string,
): number | null => {
	const own = history.get(model)?.get(caseId) ?? []
	const samples = own.some(isWarm) ? own.filter(isWarm) : own
	return samples.length > 0
		? getPercentile(
				samples.map((sample) => sample.costUsd),
				RESERVE_PERCENTILE,
			)
		: null
}

export const getHistoryReserveUsd = (p95Usd: number): number =>
	Math.max(p95Usd * RESERVE_ATTEMPTS, MIN_CASE_RESERVE_USD)

export interface CaseReserveInput {
	history: CostHistory
	model: string
	caseIds: string[]
	/** The price-based upper bound (pricing.ts), used only when there is no history. */
	upperBoundUsd: number
}

export const getCaseReserveFromHistory = (input: CaseReserveInput): number => {
	const p95 = getHistoricalP95Usd(input.history, input.model, input.caseIds)
	return p95 === null ? input.upperBoundUsd : getHistoryReserveUsd(p95)
}

/**
 * Own reserve per case that has history. One pooled p95 would let a few expensive cases (long
 * multi-meal days, ≈ $0.04–0.08) raise the reserve of all the cheap ones (≈ $0.005) in a mixed set
 * like the smoke, and a reserve of ≈ $0.1 each stops the run at the stage soft stop.
 */
export const getOwnCaseReserves = (input: CaseReserveInput): Map<string, number> => {
	const reserves = new Map<string, number>()
	for (const id of input.caseIds) {
		const p95 = getHistoricalOwnP95Usd(input.history, input.model, id)
		if (p95 !== null) reserves.set(id, getHistoryReserveUsd(p95))
	}
	return reserves
}

/**
 * The cases that start before the cache is written (the first `concurrency` of a model's run all
 * start together) reserve the cold prefix write, the rest the usual reserve.
 */
export const getStartReserveUsd = (caseReserveUsd: number, isColdStart: boolean): number =>
	isColdStart ? Math.max(caseReserveUsd, COLD_START_RESERVE_USD) : caseReserveUsd

export const RESULTS_HISTORY_DIR = new URL('../results/', import.meta.url)

export const loadCostHistory = async (dir: URL = RESULTS_HISTORY_DIR): Promise<CostHistory> => {
	const history: CostHistory = new Map()
	const root = fileURLToPath(dir)
	let names: string[]
	try {
		names = await readdir(root)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return history
		throw error
	}
	for (const name of names.filter((n) => n.endsWith('.json') || n.endsWith('.jsonl'))) {
		addToHistory(history, await loadResultsFile(fileURLToPath(new URL(name, dir))))
	}
	return history
}
