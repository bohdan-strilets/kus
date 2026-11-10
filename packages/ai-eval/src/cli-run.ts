import { type AiReasoningMode, PROMPT_VERSION } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import { print } from './cli-output.js'
import { createProgressReporter } from './progress.js'
import { getCaseReserveFromHistory, getOwnCaseReserves, loadCostHistory } from './case-reserve.js'
import { fetchPrices, getCaseReserveUsd } from './pricing.js'
import { createResultsWriter, RESULTS_DIR } from './results-store.js'
import { type ModelRun, type RunBudget, runModel } from './runner.js'
import { createLedgerRecorder, type StagePlan } from './stage-run.js'

export const INTERRUPTED_EXIT_CODE = 130

export interface PaidRunSetup {
	apiKey: string
	stage: string
	stagePlan: StagePlan
	runStartIso: string
	models: string[]
	cases: EvalCase[]
	reasoning: AiReasoningMode
	concurrency: number
	/** How many ids --only had (the ledger stores the count, never the ids). */
	onlyCount?: number
}

export interface PaidRun {
	runs: ModelRun[]
	budget: RunBudget
}

/** First Ctrl+C: finish the cases in flight and stop; the second one quits at once (the ledger is already current). */
const watchInterrupt = (budget: RunBudget): (() => void) => {
	const onSigint = (): void => {
		if (budget.isInterrupted) process.exit(INTERRUPTED_EXIT_CODE)
		budget.isInterrupted = true
		print(
			'\nCtrl+C: нові кейси не стартують, чекаю на ті, що в роботі (ще раз Ctrl+C — вийти одразу)',
		)
	}
	process.on('SIGINT', onSigint)
	return () => process.off('SIGINT', onSigint)
}

export const executePaidRun = async (setup: PaidRunSetup): Promise<PaidRun> => {
	const { stagePlan, reasoning, cases } = setup
	const maxUsd = stagePlan.capUsd
	const budget: RunBudget = {
		spentUsd: 0,
		maxUsd,
		reservedUsd: 0,
		softStopUsd: stagePlan.softStopUsd,
	}
	const prices = await fetchPrices()
	// read before this run's own file is created, so the history is only earlier runs
	const history = await loadCostHistory()
	print(
		`Ліміт прогону: $${maxUsd.toFixed(2)} (жорсткий: кейс стартує, лише якщо вміщується його резерв)`,
	)
	const reportProgress = createProgressReporter(maxUsd, print)
	const writer = await createResultsWriter(RESULTS_DIR, setup.runStartIso)
	const recorder = createLedgerRecorder(setup.stage, stagePlan.ledger, {
		at: setup.runStartIso,
		...(setup.onlyCount === undefined ? {} : { only: setup.onlyCount }),
	})
	const stopWatching = watchInterrupt(budget)

	const runs: ModelRun[] = []
	try {
		for (const model of setup.models) {
			const price = prices.get(model)
			if (!price) throw new Error(`Model "${model}" is not on OpenRouter`)
			const reserveInput = {
				history,
				model,
				caseIds: cases.map((evalCase) => evalCase.id),
				upperBoundUsd: getCaseReserveUsd(cases, price, reasoning),
			}
			// cases without own history get the model-wide (warm) p95, not the pool of the run's cases
			const caseReserveUsd = getCaseReserveFromHistory({ ...reserveInput, caseIds: [] })
			const caseReserves = getOwnCaseReserves(reserveInput)
			print(
				`▶ ${model}: ${cases.length} кейсів, резерв на кейс $${caseReserveUsd.toFixed(4)} (власна історія: ${caseReserves.size})…`,
			)
			runs.push(
				await runModel(cases, {
					apiKey: setup.apiKey,
					model,
					reasoning,
					concurrency: setup.concurrency,
					budget,
					caseReserveUsd,
					caseReserves,
					// the spend is real from the moment a case ends: file line and ledger before the next one
					onCaseDone: async (result) => {
						await Promise.all([
							writer.append({ ...result, promptVersion: PROMPT_VERSION, reasoning }),
							recorder.recordCase(result.costUsd),
						])
						reportProgress(budget.spentUsd)
					},
				}),
			)
		}
	} finally {
		stopWatching()
		await recorder.finish({ isStoppedAt80: budget.isSoftStopped === true })
	}
	return { runs, budget }
}
