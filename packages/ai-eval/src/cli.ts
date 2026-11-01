// pnpm --filter ai-eval eval --stage <етап> [--models a,b] [--max-cost 3] [--concurrency 4]
//   [--only id,id] [--smoke] [--reasoning minimal|low] (default: FOOD_PARSE_REASONING from shared)
//   pnpm --filter ai-eval eval --estimate [--models a,b] — price estimate, no key and no stage needed
//   --stage <етап> is mandatory for every paid run; create its ledger once: --stage <етап> --stage-cap 1
//   --smoke — the fixed cheap set from src/cases/smoke.ts; with --only it is a union (deduplicated)
//   [--set all|repo|private|holdout] — private = real cases from data/private (aggregated metrics
//   only); holdout = data/private/*.holdout.json, never in `all`: run once per final prompt version
//   --max-cost is hard: a case starts only if the spent + in-flight reserves + its reserve fit in it.
//   Spend is counted in the stage ledger data/private/eval-budget-<stage>.json;
//   the run's hard cap = min(--max-cost, what is left of the stage). The ledger is created with
//   --stage <name> --stage-cap <usd> (it only creates, no run). At 80 % of the stage cap no new case
//   starts and the exit code is 2; [--past-80] turns that stop off (only after the author's yes).
//   Every finished case is appended to results/<start>.jsonl and to the stage ledger at once; Ctrl+C
//   stops new cases (exit 130), the second Ctrl+C quits. results/<start>.json is the end summary.
//   pnpm --filter ai-eval eval --rescore results/<file>.json|.jsonl — recompute metrics from the saved
//   raw tool calls with the CURRENT parse code and case expectations: no network, no key, no stage.
// Paid requests use ONLY OPENROUTER_EVAL_API_KEY (a separate key with a monthly limit, apps/api/.env);
// the production OPENROUTER_API_KEY is never used. AI_MODEL also from apps/api/.env (see package.json).
// Prints to the terminal; full results (with private case ids) go to results/ — gitignored.
import { type CaseResult } from './eval.types.js'
import { loadCases, loadHoldoutCases } from './cases/index.js'
import { args, filterCases, getModels, getReasoning, HOLDOUT_SET } from './cli-args.js'
import { requireEvalKey, requireStage, parseIdList } from './cli-guards.js'
import { print, printEstimate, saveResults } from './cli-output.js'
import { printReport } from './cli-report.js'
import { executePaidRun, INTERRUPTED_EXIT_CODE } from './cli-run.js'
import { rescoreResults } from './rescore.js'
import { loadResultsFile } from './results-store.js'
import { createLedger } from './stage-ledger.js'
import { planStageRun, requireLedger, type StagePlan } from './stage-run.js'

const SOFT_STOP_EXIT_CODE = 2

const createStageLedger = async (stage: string): Promise<void> => {
	const ledger = await createLedger(stage, Number(args['stage-cap']))
	print(`Бюджет етапу ${stage} створено: стеля $${ledger.capUsd.toFixed(2)}. Прогін не запускався.`)
}

const planRun = async (stage: string, maxUsd: number): Promise<StagePlan> =>
	planStageRun(await requireLedger(stage), { maxCostUsd: maxUsd, isPast80: args['past-80'] })

const rescore = async (file: string): Promise<void> => {
	const saved: CaseResult[] = await loadResultsFile(file)
	const cases = [...(await loadCases()), ...(await loadHoldoutCases())]
	const { runs, missingCases } = rescoreResults(saved, cases)
	print(
		`Перерахунок ${saved.length - missingCases} результатів поточним кодом і очікуваннями, без запитів.`,
	)
	if (missingCases > 0) print(`Пропущено ${missingCases}: кейса вже немає.`)
	printReport(runs, 'rescore', print)
}

const main = async (): Promise<void> => {
	if (args.rescore !== undefined) {
		await rescore(args.rescore)
		return
	}
	if (args['stage-cap'] !== undefined) {
		if (!args.stage) throw new Error('--stage-cap needs --stage <name>')
		await createStageLedger(args.stage)
		return
	}
	if (args['past-80'] && !args.stage) throw new Error('--past-80 needs --stage <name>')

	// refuse a paid run before anything else: no key / no stage means no network call at all
	const apiKey = args.estimate ? '' : requireEvalKey(process.env)
	const stage = args.estimate ? '' : requireStage(args.stage)
	const models = getModels()
	const cases = await filterCases(
		args.set === HOLDOUT_SET ? await loadHoldoutCases() : await loadCases(),
	)
	if (args.estimate) {
		await printEstimate(models, cases, getReasoning())
		return
	}

	const maxCostUsd = Number(args['max-cost'])
	if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0)
		throw new Error('--max-cost must be a positive number')
	const stagePlan = await planRun(stage, maxCostUsd)
	const reasoning = getReasoning()
	const runStartIso = new Date().toISOString()
	const { runs, budget } = await executePaidRun({
		apiKey,
		stage,
		stagePlan,
		runStartIso,
		models,
		cases,
		reasoning,
		concurrency: Number(args.concurrency),
		...(args.only ? { onlyCount: parseIdList(args.only).length } : {}),
	})

	printReport(runs, reasoning, print)
	print(`
Витрачено: $${budget.spentUsd.toFixed(4)} з $${budget.maxUsd.toFixed(2)}`)
	print(`Результати: ${await saveResults(runs, reasoning, runStartIso)}`)
	if (budget.isInterrupted) {
		process.exitCode = INTERRUPTED_EXIT_CODE
		return
	}
	if (budget.isSoftStopped) {
		const notStarted = runs.reduce((sum, run) => sum + run.skipped, 0)
		const stageSpent = stagePlan.ledger.spentUsd + budget.spentUsd
		print(
			`80 % стелі етапу: витрачено $${stageSpent.toFixed(2)} з $${stagePlan.ledger.capUsd.toFixed(2)}, не запущено ${notStarted} кейсів`,
		)
		process.exitCode = SOFT_STOP_EXIT_CODE
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`)
	process.exitCode = 1
})
