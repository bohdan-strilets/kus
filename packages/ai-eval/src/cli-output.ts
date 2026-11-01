import { mkdir, writeFile } from 'node:fs/promises'

import { type AiReasoningMode, PROMPT_VERSION } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import { estimateCost } from './pricing.js'
import { RESULTS_DIR, toFileStamp } from './results-store.js'
import type { ModelRun } from './runner.js'

export const print = (text = ''): void => {
	process.stdout.write(`${text}\n`)
}

export const printEstimate = async (
	models: string[],
	cases: EvalCase[],
	reasoning: AiReasoningMode,
): Promise<void> => {
	const estimates = await estimateCost(models, cases, reasoning)
	print(`Оцінка на ${cases.length} кейсів, reasoning: ${reasoning} (верхня межа):\n`)
	print('| Модель | $/1M in | $/1M out | ~токенів in/кейс | ~$ за прогін |')
	print('|---|---|---|---|---|')
	for (const estimate of estimates) {
		print(
			`| ${estimate.model} | ${estimate.promptPerMillion.toFixed(2)} | ${estimate.completionPerMillion.toFixed(2)} | ${estimate.inputTokensPerCase} | $${estimate.usdPerRun.toFixed(2)} |`,
		)
	}
	const total = estimates.reduce((sum, estimate) => sum + estimate.usdPerRun, 0)
	print(`\nРазом ≈ $${total.toFixed(2)}`)
}

/** The summary next to the run's .jsonl (same stamp); the .jsonl is the source if the run broke half way. */
export const saveResults = async (
	runs: ModelRun[],
	reasoning: AiReasoningMode,
	runStartIso: string,
): Promise<string> => {
	await mkdir(RESULTS_DIR, { recursive: true })
	const file = new URL(`${toFileStamp(runStartIso)}.json`, RESULTS_DIR)
	const payload = runs.map((run) => ({
		model: run.model,
		promptVersion: PROMPT_VERSION,
		reasoning: reasoning,
		skipped: run.skipped,
		results: run.pairs.map(({ result }) => result),
	}))
	await writeFile(file, JSON.stringify(payload, null, '\t'))
	return file.pathname
}
