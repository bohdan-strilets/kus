import { AI_VALIDATION_RETRY_COUNT, isReadToolName } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type { CaseResult, ValidationAttempt } from './eval.types.js'
import {
	createReadExecutor,
	createReadTurn,
	getReadCalls,
	getReadClosedErrors,
	runReadStep,
} from './read-loop.js'
import { buildCaseContext } from './run-case.js'
import type { ModelRun } from './runner.js'
import {
	failedResult,
	OUTPUT_TRUNCATED,
	scoreAttempt,
	toValidationAttempt,
} from './score-attempt.js'

const INVALID_TOOL_CALLS = 'INVALID_TOOL_CALLS'

export const RESCORE_NO_RAW_MESSAGE =
	'--rescore: у файлі немає сирих викликів інструментів (rawAttempts) — перерахувати можна лише результати, збережені після їх появи. Старі файли не перераховуються.'

/**
 * Re-runs the current parse/validation and metrics on the saved raw answers of one case. The read
 * rounds are answered again from the case's data (no model call), so a case's refs resolve as they did.
 */
export const rescoreResult = (evalCase: EvalCase, saved: CaseResult): CaseResult => {
	const rawAttempts = saved.rawAttempts ?? []
	const context = buildCaseContext(evalCase)
	const base = { caseId: saved.caseId, model: saved.model }
	const usage = {
		costUsd: saved.costUsd,
		latencyMs: saved.latencyMs,
		inputTokens: saved.inputTokens,
		outputTokens: saved.outputTokens,
		cachedTokens: saved.cachedTokens,
		textOnlyAnswers: saved.textOnlyAnswers,
	}
	const validationErrors: ValidationAttempt[] = []
	const readTurn = createReadTurn()
	const executeRead = createReadExecutor(evalCase, context)
	let attempt = 0
	for (const answer of rawAttempts) {
		if (answer.isReadStep) {
			runReadStep(readTurn, executeRead, getReadCalls(answer.toolCalls))
			continue
		}
		attempt += 1
		if (answer.isTruncated)
			return failedResult(base, usage, {
				error: OUTPUT_TRUNCATED,
				attempts: attempt,
				validationErrors,
				rawAttempts,
				reads: readTurn.stats,
			})
		const wantsRead = answer.toolCalls.some((call) => isReadToolName(call.name))
		const outcome = wantsRead
			? { errors: getReadClosedErrors(answer.toolCalls) }
			: scoreAttempt({
					evalCase,
					context,
					base,
					usage,
					attempt,
					rawCalls: answer.toolCalls,
					validationErrors,
					rawAttempts,
					statsFollowUp: saved.statsFollowUp,
					reads: readTurn,
				})
		if ('result' in outcome) return outcome.result
		validationErrors.push(
			toValidationAttempt(
				attempt,
				answer.toolCalls.map((call) => call.name),
				outcome.errors,
			),
		)
	}
	// a request that failed in the network is not a parsing matter: keep its error as it was
	const keptError = saved.error !== INVALID_TOOL_CALLS ? saved.error : null
	return failedResult(base, usage, {
		error: keptError ?? INVALID_TOOL_CALLS,
		attempts: keptError ? saved.attempts : 1 + AI_VALIDATION_RETRY_COUNT,
		validationErrors,
		rawAttempts,
		reads: readTurn.stats,
	})
}

export interface RescoreOutcome {
	runs: ModelRun[]
	/** Saved results whose case no longer exists. */
	missingCases: number
}

export const rescoreResults = (saved: CaseResult[], cases: readonly EvalCase[]): RescoreOutcome => {
	if (saved.length === 0) throw new Error('--rescore: у файлі немає результатів')
	if (saved.some((result) => result.rawAttempts === undefined))
		throw new Error(RESCORE_NO_RAW_MESSAGE)
	const byId = new Map(cases.map((evalCase) => [evalCase.id, evalCase]))
	const runs = new Map<string, ModelRun>()
	let missingCases = 0
	for (const result of saved) {
		const evalCase = byId.get(result.caseId)
		if (!evalCase) {
			missingCases += 1
			continue
		}
		const run = runs.get(result.model) ?? {
			model: result.model,
			pairs: [],
			skipped: 0,
			overReserve: [],
			isSoftStopped: false,
		}
		run.pairs.push({ evalCase, result: rescoreResult(evalCase, result) })
		runs.set(result.model, run)
	}
	return { runs: [...runs.values()], missingCases }
}
