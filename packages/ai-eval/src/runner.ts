import type { AiReasoningMode } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { runCase } from './run-case.js'

export interface RunOptions {
	apiKey: string
	model: string
	reasoning: AiReasoningMode
	concurrency: number
	/** Shared across models of one run; checked before each case starts. */
	budget: { spentUsd: number; maxUsd: number }
	onCaseDone?: (result: CaseResult) => void
}

export interface ModelRun {
	model: string
	pairs: { evalCase: EvalCase; result: CaseResult }[]
	/** Cases not started because the budget ran out. */
	skipped: number
}

export const runModel = async (cases: EvalCase[], options: RunOptions): Promise<ModelRun> => {
	const pairs: ModelRun['pairs'] = []
	let next = 0
	let skipped = 0

	const worker = async (): Promise<void> => {
		while (next < cases.length) {
			const evalCase = cases[next]
			next += 1
			if (!evalCase) return
			if (options.budget.spentUsd >= options.budget.maxUsd) {
				skipped += 1
				continue
			}
			const result = await runCase(evalCase, options)
			options.budget.spentUsd += result.costUsd
			pairs.push({ evalCase, result })
			options.onCaseDone?.(result)
		}
	}

	await Promise.all(Array.from({ length: options.concurrency }, worker))
	// keep the case order stable for the report and diffs between runs
	const order = new Map(cases.map((evalCase, index) => [evalCase.id, index]))
	pairs.sort((a, b) => (order.get(a.evalCase.id) ?? 0) - (order.get(b.evalCase.id) ?? 0))
	return { model: options.model, pairs, skipped }
}
