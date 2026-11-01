import { type AiReasoningMode, PROMPT_VERSION } from '@kus/shared'

import { isHiddenCaseId } from './cases/private-cases.js'
import { summarize } from './metrics.js'
import {
	formatClarifyReport,
	formatDecisionBreakdown,
	formatMisses,
	formatMixedScript,
	formatSummaryTable,
	formatValidationRetries,
} from './report.js'
import { formatReplyChecks } from './reply-report.js'
import type { ModelRun } from './runner.js'

export const printReport = (
	runs: ModelRun[],
	reasoning: AiReasoningMode,
	print: (text?: string) => void,
): void => {
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
		const retries = formatValidationRetries(run.pairs)
		if (retries) print(`\nПомилки валідації ${run.model}:\n${retries}`)
		print(`\n${run.model}: ${formatMixedScript(run.pairs)}`)
		print(`\nПеревірки reply ${run.model}:\n${formatReplyChecks(run.pairs)}`)
		if (run.skipped > 0 && !run.isSoftStopped)
			print(`\n⚠ ${run.model}: пропущено ${run.skipped} кейсів — резерв не вміщується в --max-cost`)
		if (run.overReserve.length > 0)
			print(
				`\n⚠ ${run.model}: дорожче за резерв (${run.overReserve.length}): ${run.overReserve.filter((id) => !isHiddenCaseId(id)).join(', ')} — перекалібрувати pricing.ts`,
			)
	}
}
