// Why an expected clarify question didn't reach the user — so a "wrong" decision can be told apart
// from a reasonable one: an item fully covered by a saved food needs no question.
import { normalizeName } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import type { CaseResult } from './eval.types.js'
import { isDecisionCorrect } from './metrics.js'

export type MissedClarifyReason = 'not_asked' | 'below_threshold' | 'memory_covered'

export const MISSED_CLARIFY_LABELS: Record<MissedClarifyReason, string> = {
	not_asked: 'модель не спитала',
	below_threshold: 'спитала, але бекенд відкинув (поріг 80 ккал / 15 % або ліміт 2 питання)',
	memory_covered: 'позиція покрита збереженим продуктом',
}

/**
 * Words that change a saved food or its amount. Wider on purpose than the prompt's override rule
 * ("половина" keeps MEMORY there): here the question is only whether memory alone settles the
 * item so well that no question was needed — any doubt counts as "not covered".
 */
const QUALIFIER_STEMS = ['рідк', 'без ', 'половин', 'маленьк', 'велик', 'частин', 'трохи', '~', '≈']
/** Characters around the item — catches "3 печива, але маленькі" across the comma. */
const CONTEXT_WINDOW = 40
const HAS_NUMBER = /\d/

const isStemCoveredByMemory = (stem: string, evalCase: EvalCase, result: CaseResult): boolean => {
	const normalizedStem = normalizeName(stem)
	const food = (evalCase.context?.memory ?? []).find((saved) =>
		[saved.name, ...saved.aliases].some((name) => normalizeName(name).includes(normalizedStem)),
	)
	if (!food) return false
	if (!result.items.some((item) => item.memoryRef === food.ref)) return false
	const text = normalizeName(evalCase.text)
	const position = text.indexOf(normalizedStem)
	if (position === -1) return false
	const window = text.slice(
		Math.max(0, position - CONTEXT_WINDOW),
		position + normalizedStem.length + CONTEXT_WINDOW,
	)
	// "з'їв печиво" without an amount still needs a question, saved food or not
	if (!HAS_NUMBER.test(window)) return false
	return !QUALIFIER_STEMS.some((qualifier) => window.includes(qualifier))
}

/** null = no clarify was expected, or it was asked. */
export const explainMissedClarify = (
	evalCase: EvalCase,
	result: CaseResult,
): MissedClarifyReason | null => {
	if (evalCase.expect.decision !== 'clarify' || result.decision === 'clarify') return null
	if (result.decision === 'error') return null
	const stems = evalCase.expect.clarifyAbout ?? []
	if (stems.length > 0 && stems.every((stem) => isStemCoveredByMemory(stem, evalCase, result))) {
		return 'memory_covered'
	}
	return result.clarifyCalls.length > 0 ? 'below_threshold' : 'not_asked'
}

/** Like isDecisionCorrect, but logging without a question is right when memory covers the items. */
export const isDecisionCorrectWithMemory = (evalCase: EvalCase, result: CaseResult): boolean =>
	isDecisionCorrect(evalCase, result.decision, result.replyText) ||
	(result.decision === 'log' && explainMissedClarify(evalCase, result) === 'memory_covered')
