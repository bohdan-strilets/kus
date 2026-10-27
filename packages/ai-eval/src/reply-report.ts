import { UNDETAILED_ENTRY_NAME } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import { isHiddenCaseId } from './cases/private-cases.js'
import type { CaseResult } from './eval.types.js'
import {
	detectLanguage,
	findGenderedForms,
	getReplyOpening,
	isNameFromText,
} from './reply-checks.js'

interface Pair {
	evalCase: EvalCase
	result: CaseResult
}

const REPEATED_OPENING_MIN = 3
const P50 = 0.5
const P90 = 0.9

const isPrivate = ({ evalCase }: Pair): boolean => isHiddenCaseId(evalCase.id)

const formatFlagged = (
	title: string,
	flagged: { pair: Pair; detail: string }[],
	total: number,
): string => {
	const lines = flagged
		.filter(({ pair }) => !isPrivate(pair))
		.map(({ pair, detail }) => `- ${pair.evalCase.id}: ${detail}`)
	const hidden = flagged.length - lines.length
	return [
		`${title}: ${flagged.length} з ${total}`,
		...lines,
		...(hidden > 0 ? [`- приватних: ${hidden}`] : []),
	].join('\n')
}

const formatGender = (pairs: Pair[]): string => {
	const withReply = pairs.filter(({ result }) => result.replyText)
	const flagged = withReply.flatMap((pair) => {
		const forms = findGenderedForms(pair.result.replyText ?? '')
		return forms.length > 0 ? [{ pair, detail: forms.join(', ') }] : []
	})
	return formatFlagged('Стать користувача в reply (ціль 0)', flagged, withReply.length)
}

/** A name the user never wrote: «слизу» for «сливи». Copies, memory, photos and day totals are skipped. */
const formatNames = (pairs: Pair[]): string => {
	let total = 0
	const flagged = pairs.flatMap((pair) => {
		const { evalCase, result } = pair
		if (evalCase.image !== undefined || evalCase.text === '') return []
		const items = result.items.filter(
			(item) => !item.memoryRef && !item.copyRef && item.name !== UNDETAILED_ENTRY_NAME,
		)
		total += items.length
		return items
			.filter((item) => !isNameFromText(item.name, evalCase.text))
			.map((item) => ({ pair, detail: item.name }))
	})
	return formatFlagged('Назви не зі слів користувача', flagged, total)
}

const formatLanguage = (pairs: Pair[]): string => {
	let total = 0
	const flagged = pairs.flatMap((pair) => {
		const expected = pair.evalCase.expect.replyLang ?? detectLanguage(pair.evalCase.text)
		const actual = detectLanguage(pair.result.replyText ?? '')
		if (!expected || !actual) return []
		total += 1
		return expected === actual ? [] : [{ pair, detail: `${expected} → ${actual}` }]
	})
	return formatFlagged('Мова reply ≠ мова повідомлення', flagged, total)
}

const formatOpenings = (pairs: Pair[]): string => {
	const counts = new Map<string, number>()
	for (const pair of pairs) {
		const { result } = pair
		if (!result.replyText || isPrivate(pair)) continue
		const opening = getReplyOpening(result.replyText)
		counts.set(opening, (counts.get(opening) ?? 0) + 1)
	}
	const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
	const repeated = [...counts]
		.filter(([, count]) => count >= REPEATED_OPENING_MIN)
		.sort((a, b) => b[1] - a[1])
		.map(([opening, count]) => `- «${opening}…» ×${count}`)
	return [`Початки reply: різних ${counts.size} з ${total}`, ...repeated].join('\n')
}

const getPercentile = (values: number[], percentile: number): number => {
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)] ?? 0
}

const formatOutputTokens = (pairs: Pair[]): string => {
	const tokens = pairs.map(({ result }) => result.outputTokens)
	return `Вихідні токени на кейс: p50 ${getPercentile(tokens, P50)}, p90 ${getPercentile(tokens, P90)}`
}

/** Checks on every reply of the run; informational, they don't change the decision score. */
export const formatReplyChecks = (pairs: Pair[]): string =>
	[
		formatGender(pairs),
		formatNames(pairs),
		formatLanguage(pairs),
		formatOpenings(pairs),
		formatOutputTokens(pairs),
	].join('\n\n')
