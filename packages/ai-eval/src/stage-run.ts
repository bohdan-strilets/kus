import {
	addRun,
	getEffectiveCapUsd,
	getLedgerFile,
	LEDGER_DIR,
	getSoftStopUsd,
	loadLedger,
	saveLedger,
	type LedgerRun,
	type StageLedger,
} from './stage-ledger.js'

export interface StagePlan {
	ledger: StageLedger
	capUsd: number
	/** Undefined with --past-80: only the hard cap applies. */
	softStopUsd: number | undefined
}

export const planStageRun = (
	ledger: StageLedger,
	options: { maxCostUsd: number; isPast80: boolean },
): StagePlan => {
	const capUsd = getEffectiveCapUsd(options.maxCostUsd, ledger)
	if (capUsd <= 0) {
		throw new Error(
			`Стелю етапу вичерпано: витрачено $${ledger.spentUsd.toFixed(2)} з $${ledger.capUsd.toFixed(2)}`,
		)
	}
	return { ledger, capUsd, softStopUsd: options.isPast80 ? undefined : getSoftStopUsd(ledger) }
}

export const requireLedger = async (stage: string): Promise<StageLedger> => {
	const ledger = await loadLedger(stage)
	if (ledger) return ledger
	const name = getLedgerFile(stage).pathname.split('/').pop()
	throw new Error(
		`Немає бюджету етапу ${stage} (${name}). Створи його: --stage ${stage} --stage-cap 0.3`,
	)
}

export interface LedgerRecorder {
	/** Adds a finished case to the ledger and resolves once the file is written. */
	recordCase: (costUsd: number) => Promise<void>
	/** Final write: marks the soft stop; also the only write of a run that finished no case. */
	finish: (options: { isStoppedAt80: boolean }) => Promise<void>
}

/**
 * The stage total equals the sum of the finished cases at every moment, so Ctrl+C or a crash loses
 * nothing: each case rewrites the ledger atomically (writes are queued, never concurrent).
 */
export const createLedgerRecorder = (
	stage: string,
	ledger: StageLedger,
	start: { at: string; only?: number },
	dir: URL = LEDGER_DIR,
): LedgerRecorder => {
	const run: LedgerRun = {
		at: start.at,
		...(start.only === undefined ? {} : { only: start.only }),
		cases: 0,
		spentUsd: 0,
	}
	let chain: Promise<void> = Promise.resolve()
	const write = (snapshot: LedgerRun): Promise<void> => {
		const saved = chain.then(() => saveLedger(stage, addRun(ledger, snapshot), dir))
		chain = saved.catch(() => undefined)
		return saved
	}
	return {
		recordCase: (costUsd) => {
			run.cases += 1
			run.spentUsd += costUsd
			return write({ ...run })
		},
		finish: ({ isStoppedAt80 }) =>
			write({ ...run, ...(isStoppedAt80 ? { stoppedAt80: true } : {}) }),
	}
}
