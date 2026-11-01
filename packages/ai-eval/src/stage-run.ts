import {
	addRun,
	getEffectiveCapUsd,
	getLedgerFile,
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
		`Немає бюджету етапу ${stage} (${name}). Створи його: --stage ${stage} --stage-cap <usd>`,
	)
}

export const recordStageRun = async (
	stage: string,
	ledger: StageLedger,
	run: LedgerRun,
): Promise<void> => {
	await saveLedger(stage, addRun(ledger, run))
}
