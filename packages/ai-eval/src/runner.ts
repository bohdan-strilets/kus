import type { AiReasoningMode } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { runCase } from './run-case.js'

/** Shared across models of one run. */
export interface RunBudget {
	spentUsd: number
	maxUsd: number
	/** Reserves of the cases still in flight. */
	reservedUsd: number
}

export interface RunOptions {
	apiKey: string
	model: string
	reasoning: AiReasoningMode
	concurrency: number
	budget: RunBudget
	/** Reserved before each case starts (see getCaseReserveUsd), so the run stops before --max-cost. */
	caseReserveUsd: number
	onCaseDone?: (result: CaseResult) => void
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
}

export const canStartCase = (budget: RunBudget, reserveUsd: number): boolean =>
	budget.spentUsd + budget.reservedUsd + reserveUsd <= budget.maxUsd

export const runModel = async (cases: EvalCase[], options: RunOptions): Promise<ModelRun> => {
	const { budget, caseReserveUsd } = options
	const pairs: ModelRun['pairs'] = []
	const overReserve: string[] = []
	const inFlight = new Set<Promise<void>>()
	let next = 0
	let skipped = 0

	const runReserved = async (evalCase: EvalCase): Promise<void> => {
		budget.reservedUsd += caseReserveUsd
		try {
			const result = await runCase(evalCase, options)
			budget.spentUsd += result.costUsd
			if (result.costUsd > caseReserveUsd) overReserve.push(evalCase.id)
			pairs.push({ evalCase, result })
			options.onCaseDone?.(result)
		} finally {
			budget.reservedUsd -= caseReserveUsd
		}
	}

	const worker = async (): Promise<void> => {
		while (next < cases.length) {
			const evalCase = cases[next]
			next += 1
			if (!evalCase) return
			// a case in flight may finish under its reserve and free room for this one
			while (!canStartCase(budget, caseReserveUsd) && inFlight.size > 0) {
				await Promise.race(inFlight)
			}
			if (!canStartCase(budget, caseReserveUsd)) {
				// nothing in flight, so the budget only shrinks from here: skip the rest
				skipped += cases.length - next + 1
				next = cases.length
				return
			}
			const task = runReserved(evalCase)
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
		}
	}

	await Promise.all(Array.from({ length: options.concurrency }, worker))
	// keep the case order stable for the report and diffs between runs
	const order = new Map(cases.map((evalCase, index) => [evalCase.id, index]))
	pairs.sort((a, b) => (order.get(a.evalCase.id) ?? 0) - (order.get(b.evalCase.id) ?? 0))
	return { model: options.model, pairs, skipped, overReserve }
}
