import type { AiReasoningMode } from '@kus/shared'

import { getStartReserveUsd } from './case-reserve.js'
import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { runCase } from './run-case.js'

/** Shared across models of one run. */
export interface RunBudget {
	spentUsd: number
	maxUsd: number
	/** Reserves of the cases still in flight. */
	reservedUsd: number
	/** Stage soft stop: once spent + reserved reach it, no new case starts (the hard maxUsd still applies). */
	softStopUsd?: number
	isSoftStopped?: boolean
	/** Ctrl+C: cases in flight finish (and are paid for), no new one starts. */
	isInterrupted?: boolean
}

export interface RunOptions {
	apiKey: string
	model: string
	reasoning: AiReasoningMode
	concurrency: number
	budget: RunBudget
	/** Reserved before each case starts (see getCaseReserveFromHistory), so the run stops before --max-cost. */
	caseReserveUsd: number
	/** Reserves of cases with their own history (by case id); the others get caseReserveUsd. */
	caseReserves?: ReadonlyMap<string, number>
	/** Awaited: a case counts as done only after its result is written. */
	onCaseDone?: (result: CaseResult) => void | Promise<void>
}

export interface ModelRun {
	model: string
	pairs: { evalCase: EvalCase; result: CaseResult }[]
	/** Cases not started because the budget could not cover their reserve. */
	skipped: number
	/**
	 * Cases that cost more than their reserve: the estimate needs a new calibration. Only then can a
	 * run pass --max-cost (by at most that overrun), so it is reported, never hidden.
	 */
	overReserve: string[]
	/** The stage soft stop ended the run; `skipped` counts the cases left. */
	isSoftStopped: boolean
	/** Ctrl+C ended the run; `skipped` counts the cases left. */
	isInterrupted?: boolean
}

export const canStartCase = (budget: RunBudget, reserveUsd: number): boolean =>
	budget.spentUsd + budget.reservedUsd + reserveUsd <= budget.maxUsd

export const hasReachedSoftStop = (budget: RunBudget): boolean => {
	if (budget.isSoftStopped) return true
	if (budget.softStopUsd === undefined) return false
	return budget.spentUsd + budget.reservedUsd >= budget.softStopUsd
}

export const runModel = async (cases: EvalCase[], options: RunOptions): Promise<ModelRun> => {
	const { budget, caseReserveUsd } = options
	const pairs: ModelRun['pairs'] = []
	const overReserve: string[] = []
	const inFlight = new Set<Promise<void>>()
	let next = 0
	let skipped = 0
	let started = 0

	const runReserved = async (evalCase: EvalCase, reserveUsd: number): Promise<void> => {
		budget.reservedUsd += reserveUsd
		try {
			const result = await runCase(evalCase, options)
			budget.spentUsd += result.costUsd
			if (result.costUsd > reserveUsd) overReserve.push(evalCase.id)
			pairs.push({ evalCase, result })
			await options.onCaseDone?.(result)
		} finally {
			budget.reservedUsd -= reserveUsd
		}
	}

	const stopAtSoftLimit = (): boolean => {
		if (budget.isInterrupted) {
			skipped += cases.length - next + 1
			next = cases.length
			return true
		}
		if (!hasReachedSoftStop(budget)) return false
		budget.isSoftStopped = true
		skipped += cases.length - next + 1
		next = cases.length
		return true
	}

	// only the first case meets the cache cold: it runs alone (warm-up) and reserves the prefix write
	const getReserveUsd = (evalCase: EvalCase): number =>
		getStartReserveUsd(options.caseReserves?.get(evalCase.id) ?? caseReserveUsd, started === 0)

	/** Takes the next case and runs it; false = nothing left for this worker. */
	const runNext = async (): Promise<boolean> => {
		const evalCase = cases[next]
		if (!evalCase) return false
		next += 1
		if (stopAtSoftLimit()) return false
		// a case in flight may finish under its reserve and free room for this one
		while (!canStartCase(budget, getReserveUsd(evalCase)) && inFlight.size > 0) {
			await Promise.race(inFlight)
		}
		if (stopAtSoftLimit()) return false
		if (!canStartCase(budget, getReserveUsd(evalCase))) {
			// nothing in flight, so the budget only shrinks from here: skip the rest
			skipped += cases.length - next + 1
			next = cases.length
			return false
		}
		const reserveUsd = getReserveUsd(evalCase)
		started += 1
		const task = runReserved(evalCase, reserveUsd)
		// waiters only need to know it settled; this worker still sees the error
		const settled = task.then(
			() => undefined,
			() => undefined,
		)
		inFlight.add(settled)
		try {
			await task
		} finally {
			inFlight.delete(settled)
		}
		return true
	}

	const worker = async (): Promise<void> => {
		while (await runNext());
	}

	// warm-up: the first case alone writes the prompt cache, the others then read it instead of each
	// paying the write. A failed case is an ordinary result (runCase does not throw for it), so the rest goes on.
	await runNext()
	await Promise.all(Array.from({ length: options.concurrency }, worker))
	// keep the case order stable for the report and diffs between runs
	const order = new Map(cases.map((evalCase, index) => [evalCase.id, index]))
	pairs.sort((a, b) => (order.get(a.evalCase.id) ?? 0) - (order.get(b.evalCase.id) ?? 0))
	return {
		model: options.model,
		pairs,
		skipped,
		overReserve,
		isSoftStopped: budget.isSoftStopped === true,
		isInterrupted: budget.isInterrupted === true,
	}
}
