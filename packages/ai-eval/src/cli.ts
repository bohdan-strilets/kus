// pnpm --filter ai-eval eval [--models a,b] [--estimate] [--max-cost 3] [--concurrency 4] [--only id,id]
//   [--reasoning minimal|low] (default: FOOD_PARSE_REASONING from shared)
//   [--set all|repo|private] — private = real cases from data/private (aggregated metrics only)
// Reads OPENROUTER_API_KEY and AI_MODEL from apps/api/.env (see package.json). Prints to the terminal;
// full results (with private case ids) go to results/ — gitignored.
import { mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import {
	AI_REASONING_MODES,
	type AiReasoningMode,
	FOOD_PARSE_REASONING,
	PROMPT_VERSION,
} from '@kus/shared'

import { type EvalCase, loadCases } from './cases/index.js'
import { PRIVATE_ID_PREFIX } from './cases/private-cases.js'
import { summarize } from './metrics.js'
import { estimateCost } from './pricing.js'
import {
	formatClarifyReport,
	formatDecisionBreakdown,
	formatMisses,
	formatSummaryTable,
} from './report.js'
import { type ModelRun, runModel } from './runner.js'

const DEFAULT_MAX_COST_USD = 3
const DEFAULT_CONCURRENCY = 4
const RESULTS_DIR = new URL('../results/', import.meta.url)

const { values: args } = parseArgs({
	options: {
		models: { type: 'string' },
		estimate: { type: 'boolean', default: false },
		'max-cost': { type: 'string', default: String(DEFAULT_MAX_COST_USD) },
		concurrency: { type: 'string', default: String(DEFAULT_CONCURRENCY) },
		only: { type: 'string' },
		set: { type: 'string', default: 'all' },
		reasoning: { type: 'string', default: FOOD_PARSE_REASONING },
	},
})

const isReasoningMode = (value: string): value is AiReasoningMode =>
	Object.hasOwn(AI_REASONING_MODES, value)

const getReasoning = (): AiReasoningMode => {
	if (!isReasoningMode(args.reasoning)) {
		throw new Error(`--reasoning must be one of: ${Object.keys(AI_REASONING_MODES).join(', ')}`)
	}
	return args.reasoning
}

const print = (text = ''): void => {
	process.stdout.write(`${text}\n`)
}

const getModels = (): string[] => {
	const list = args.models ?? process.env.AI_MODEL ?? ''
	const models = list
		.split(',')
		.map((model) => model.trim())
		.filter(Boolean)
	if (models.length === 0)
		throw new Error('No model: pass --models or set AI_MODEL in apps/api/.env')
	return models
}

const CASE_SETS = new Set(['all', 'repo', 'private'])

const isInSet = (evalCase: EvalCase): boolean => {
	const isPrivate = evalCase.id.startsWith(PRIVATE_ID_PREFIX)
	if (args.set === 'private') return isPrivate
	if (args.set === 'repo') return !isPrivate
	return true
}

const filterCases = (cases: EvalCase[]): EvalCase[] => {
	if (!CASE_SETS.has(args.set))
		throw new Error(`--set must be one of: ${[...CASE_SETS].join(', ')}`)
	const inSet = cases.filter(isInSet)
	if (!args.only) return inSet
	const ids = new Set(args.only.split(',').map((id) => id.trim()))
	return inSet.filter((evalCase) => ids.has(evalCase.id))
}

const printEstimate = async (models: string[], cases: EvalCase[]): Promise<void> => {
	const estimates = await estimateCost(models, cases, getReasoning())
	print(`Оцінка на ${cases.length} кейсів, reasoning: ${getReasoning()} (верхня межа):\n`)
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

const saveResults = async (runs: ModelRun[]): Promise<string> => {
	await mkdir(RESULTS_DIR, { recursive: true })
	const file = new URL(`${new Date().toISOString().replace(/[:.]/g, '-')}.json`, RESULTS_DIR)
	const payload = runs.map((run) => ({
		model: run.model,
		promptVersion: PROMPT_VERSION,
		reasoning: getReasoning(),
		skipped: run.skipped,
		results: run.pairs.map(({ result }) => result),
	}))
	await writeFile(file, JSON.stringify(payload, null, '\t'))
	return file.pathname
}

const main = async (): Promise<void> => {
	const models = getModels()
	const cases = filterCases(await loadCases())
	if (args.estimate) {
		await printEstimate(models, cases)
		return
	}

	const apiKey = process.env.OPENROUTER_API_KEY
	if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (apps/api/.env)')
	const budget = { spentUsd: 0, maxUsd: Number(args['max-cost']) }
	const concurrency = Number(args.concurrency)
	const reasoning = getReasoning()

	const runs: ModelRun[] = []
	for (const model of models) {
		print(`▶ ${model}: ${cases.length} кейсів…`)
		runs.push(await runModel(cases, { apiKey, model, reasoning, concurrency, budget }))
	}

	const summaries = runs.map((run) => summarize(run.model, run.pairs))
	print(
		`\nПромпт ${PROMPT_VERSION}, reasoning: ${reasoning}. Похибка: середня / медіана, % від еталону.\n`,
	)
	print(formatSummaryTable(summaries))
	print('\nРішення за очікуваним типом:\n')
	print(formatDecisionBreakdown(summaries))
	for (const run of runs) {
		print(`\nУточнення ${run.model}:\n${formatClarifyReport(run.pairs)}`)
		const misses = formatMisses(run.pairs)
		if (misses) print(`\nПромахи ${run.model}:\n${misses}`)
		if (run.skipped > 0)
			print(`\n⚠ ${run.model}: пропущено ${run.skipped} кейсів — вичерпано --max-cost`)
	}
	print(`\nВитрачено: $${budget.spentUsd.toFixed(4)}`)
	print(`Результати: ${await saveResults(runs)}`)
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
	process.exitCode = 1
})
