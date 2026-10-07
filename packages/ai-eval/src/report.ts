import type { EvalCase } from './cases/index.js'
import type { CaseResult, ErrorStats, ModelSummary, RateStats } from './eval.types.js'
import {
	explainMissedClarify,
	isDecisionCorrectWithMemory,
	MISSED_CLARIFY_LABELS,
} from './clarify-analysis.js'
import { getErrorPct, isDecisionCorrect, MIN_BASE } from './metrics.js'

const PERCENT = 100
const WORST_CASES_SHOWN = 8

const formatPct = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)}%`)

const formatErrors = ({ count, meanPct, medianPct }: ErrorStats): string =>
	count === 0 ? '—' : `${formatPct(meanPct)} / ${formatPct(medianPct)} (n=${count})`

const formatRate = ({ correct, total }: RateStats): string =>
	total === 0 ? '—' : `${((correct / total) * PERCENT).toFixed(1)}% (${correct}/${total})`

export const formatSummaryTable = (summaries: ModelSummary[]): string => {
	const header = [
		'| Модель | ккал точні: сер / мед | ккал діапазон | білок точні | білок діапазон | категорії | рішення | без інструмента | повтор / збій / обрізано | $/запит | мс p50 / p95 | токени in / out | cached/запит |',
		'|---|---|---|---|---|---|---|---|---|---|---|---|---|',
	]
	const rows = summaries.map((summary) => {
		const { inputPerCase, outputPerCase, cachedPerCase } = summary.tokens
		const cachedShare = inputPerCase > 0 ? (cachedPerCase / inputPerCase) * PERCENT : null
		return [
			summary.model,
			formatErrors(summary.kcal.exact),
			formatErrors(summary.kcal.range),
			formatErrors(summary.protein.exact),
			formatErrors(summary.protein.range),
			formatRate(summary.categories),
			formatRate(summary.decisions),
			formatRate({ correct: summary.modelCalls.textOnly, total: summary.modelCalls.total }),
			`${summary.retried} / ${summary.failed} / ${summary.truncated}`,
			`$${summary.costUsd.perCase.toFixed(5)}`,
			`${Math.round(summary.latencyMs.p50)} / ${Math.round(summary.latencyMs.p95)}`,
			`${Math.round(inputPerCase)} / ${Math.round(outputPerCase)}`,
			`${Math.round(cachedPerCase)} (${formatPct(cachedShare)})`,
		].join(' | ')
	})
	return [...header, ...rows.map((row) => `| ${row} |`)].join('\n')
}

export const formatDecisionBreakdown = (summaries: ModelSummary[]): string => {
	const kinds = [
		...new Set(summaries.flatMap((summary) => Object.keys(summary.decisions.byExpected))),
	].sort()
	const header = [`| Модель | ${kinds.join(' | ')} |`, `|---|${kinds.map(() => '---').join('|')}|`]
	const rows = summaries.map(
		(summary) =>
			`| ${summary.model} | ${kinds
				.map((kind) => formatRate(summary.decisions.byExpected[kind] ?? { correct: 0, total: 0 }))
				.join(' | ')} |`,
	)
	return [...header, ...rows].join('\n')
}

interface Miss {
	caseId: string
	issue: string
	/** null = a wrong decision, not a kcal miss. */
	errorPct: number | null
}

const describeMiss = (evalCase: EvalCase, result: CaseResult): Miss[] => {
	const misses: Miss[] = []
	if (!isDecisionCorrect(evalCase, result.decision, result.replyText)) {
		const detail = result.error ? ` (${result.error})` : ''
		misses.push({
			caseId: evalCase.id,
			issue: `рішення ${result.decision}${detail}, очікувалось ${evalCase.expect.decision}`,
			errorPct: null,
		})
	}
	const { kcal } = evalCase.expect
	if (kcal && result.kcal !== null) {
		const errorPct = getErrorPct(kcal, result.kcal, MIN_BASE.kcal)
		const expected = 'exact' in kcal ? `${kcal.exact}` : `${kcal.min}–${kcal.max}`
		if (errorPct > 0) {
			misses.push({
				caseId: evalCase.id,
				issue: `ккал ${Math.round(result.kcal)} замість ${expected} (${errorPct.toFixed(0)}%)`,
				errorPct,
			})
		}
	}
	return misses
}

/** The largest kcal misses and every wrong decision — what to look at when tuning the prompt. */
export const formatMisses = (pairs: { evalCase: EvalCase; result: CaseResult }[]): string => {
	const misses = pairs.flatMap(({ evalCase, result }) => describeMiss(evalCase, result))
	const decisionMisses = misses.filter((miss) => miss.issue.startsWith('рішення'))
	const kcalMisses = misses
		.filter((miss) => miss.issue.startsWith('ккал'))
		.sort(
			(a, b) => Number(/\((\d+)%\)/.exec(b.issue)?.[1]) - Number(/\((\d+)%\)/.exec(a.issue)?.[1]),
		)
		.slice(0, WORST_CASES_SHOWN)
	return [...decisionMisses, ...kcalMisses]
		.map((miss) => `- ${miss.caseId}: ${miss.issue}`)
		.join('\n')
}

type Pair = { evalCase: EvalCase; result: CaseResult }

/** Each expected-but-missing question with its reason, and decisions recounted with memory. */
export const formatClarifyReport = (pairs: Pair[]): string => {
	const reasons = pairs.flatMap(({ evalCase, result }) => {
		const reason = explainMissedClarify(evalCase, result)
		if (!reason) return []
		const asked = result.clarifyCalls
			.map((call) => `${Math.round(call.impactKcal)} ккал${call.isKept ? '' : ' (відкинуто)'}`)
			.join(', ')
		return [
			`- ${evalCase.id}: ${MISSED_CLARIFY_LABELS[reason]}${asked ? `; питання: ${asked}` : ''}`,
		]
	})
	const correct = pairs.filter(({ evalCase, result }) =>
		isDecisionCorrectWithMemory(evalCase, result),
	).length
	const withMemory = `Рішення з урахуванням пам'яті: ${formatRate({ correct, total: pairs.length })}`
	return [withMemory, ...reasons].join('\n')
}
