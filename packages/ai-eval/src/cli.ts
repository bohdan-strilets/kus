// pnpm --filter ai-eval eval [--models a,b] [--estimate] [--max-cost 3] [--concurrency 4] [--only id,id]
//   [--reasoning minimal|low] (default: FOOD_PARSE_REASONING from shared)
//   [--set all|repo|private|holdout] — private = real cases from data/private (aggregated metrics
//   only); holdout = data/private/*.holdout.json, never in `all`: run once per final prompt version
//   --max-cost is hard: a case starts only if the spent + in-flight reserves + its reserve fit in it.
//   [--stage 0.10.2] — spend is counted in the stage ledger data/private/eval-budget-<stage>.json;
//   the run's hard cap = min(--max-cost, what is left of the stage). Create the ledger once with
//   --stage <name> --stage-cap <usd> (it only creates, no run). At 80 % of the stage cap no new case
//   starts and the exit code is 2; [--past-80] turns that stop off (only after the author's yes).
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

import { type EvalCase, loadCases, loadHoldoutCases } from './cases/index.js'
import { PRIVATE_ID_PREFIX } from './cases/private-cases.js'
import { printReport } from './cli-report.js'
import { createProgressReporter } from './progress.js'
import { estimateCost, fetchPrices, getCaseReserveUsd } from './pricing.js'
import { type ModelRun, type RunBudget, runModel } from './runner.js'
import { createLedger } from './stage-ledger.js'
import { planStageRun, recordStageRun, requireLedger, type StagePlan } from './stage-run.js'

const DEFAULT_MAX_COST_USD = 3
const DEFAULT_CONCURRENCY = 4
const SOFT_STOP_EXIT_CODE = 2
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
		stage: { type: 'string' },
		'stage-cap': { type: 'string' },
		'past-80': { type: 'boolean', default: false },
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

const CASE_SETS = new Set(['all', 'repo', 'private', 'holdout'])
const HOLDOUT_SET = 'holdout'

const isInSet = (evalCase: EvalCase): boolean => {
	if (args.set === HOLDOUT_SET) return true
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

const createStageLedger = async (stage: string): Promise<void> => {
	const ledger = await createLedger(stage, Number(args['stage-cap']))
	print(`Бюджет етапу ${stage} створено: стеля $${ledger.capUsd.toFixed(2)}. Прогін не запускався.`)
}

const planRun = async (maxUsd: number): Promise<StagePlan | null> => {
	if (!args.stage) return null
	return planStageRun(await requireLedger(args.stage), {
		maxCostUsd: maxUsd,
		isPast80: args['past-80'],
	})
}

const main = async (): Promise<void> => {
	if (args['stage-cap'] !== undefined) {
		if (!args.stage) throw new Error('--stage-cap needs --stage <name>')
		await createStageLedger(args.stage)
		return
	}
	if (args['past-80'] && !args.stage) throw new Error('--past-80 needs --stage <name>')

	const models = getModels()
	const cases = filterCases(args.set === HOLDOUT_SET ? await loadHoldoutCases() : await loadCases())
	if (args.estimate) {
		await printEstimate(models, cases)
		return
	}

	const apiKey = process.env.OPENROUTER_API_KEY
	if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (apps/api/.env)')
	const maxCostUsd = Number(args['max-cost'])
	if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0)
		throw new Error('--max-cost must be a positive number')
	const stagePlan = await planRun(maxCostUsd)
	const maxUsd = stagePlan?.capUsd ?? maxCostUsd
	const budget: RunBudget = {
		spentUsd: 0,
		maxUsd,
		reservedUsd: 0,
		softStopUsd: stagePlan?.softStopUsd,
	}
	const concurrency = Number(args.concurrency)
	const reasoning = getReasoning()
	const prices = await fetchPrices()
	print(
		`Ліміт прогону: $${maxUsd.toFixed(2)} (жорсткий: кейс стартує, лише якщо вміщується його резерв)`,
	)
	const reportProgress = createProgressReporter(maxUsd, print)

	const runs: ModelRun[] = []
	try {
		for (const model of models) {
			const price = prices.get(model)
			if (!price) throw new Error(`Model "${model}" is not on OpenRouter`)
			const caseReserveUsd = getCaseReserveUsd(cases, price, reasoning)
			print(`▶ ${model}: ${cases.length} кейсів, резерв на кейс $${caseReserveUsd.toFixed(4)}…`)
			runs.push(
				await runModel(cases, {
					apiKey,
					model,
					reasoning,
					concurrency,
					budget,
					caseReserveUsd,
					onCaseDone: () => {
						reportProgress(budget.spentUsd)
					},
				}),
			)
		}
	} finally {
		// the spend is real even when the run broke half way
		if (args.stage && stagePlan) {
			await recordStageRun(args.stage, stagePlan.ledger, {
				at: new Date().toISOString(),
				...(args.only ? { only: args.only.split(',').length } : {}),
				cases: runs.reduce((sum, run) => sum + run.pairs.length, 0),
				spentUsd: budget.spentUsd,
				...(budget.isSoftStopped ? { stoppedAt80: true } : {}),
			})
		}
	}

	printReport(runs, reasoning, print)
	print(`\nВитрачено: $${budget.spentUsd.toFixed(4)} з $${budget.maxUsd.toFixed(2)}`)
	print(`Результати: ${await saveResults(runs)}`)
	if (budget.isSoftStopped && stagePlan) {
		const notStarted = runs.reduce((sum, run) => sum + run.skipped, 0)
		const stageSpent = stagePlan.ledger.spentUsd + budget.spentUsd
		print(
			`80 % стелі етапу: витрачено $${stageSpent.toFixed(2)} з $${stagePlan.ledger.capUsd.toFixed(2)}, не запущено ${notStarted} кейсів`,
		)
		process.exitCode = SOFT_STOP_EXIT_CODE
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
	process.exitCode = 1
})
