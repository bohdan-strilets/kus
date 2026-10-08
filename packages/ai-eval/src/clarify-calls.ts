import { clarifyInputSchema, type FoodParseDecision, type RawToolCall } from '@kus/shared'

import type { ClarifyCall } from './eval.types.js'

const parseArguments = (text: string): unknown => {
	try {
		return JSON.parse(text) as unknown
	} catch {
		// broken arguments already failed validation; nothing to record as a question
		return null
	}
}

/** Every valid clarify the model sent, and whether the backend thresholds let it through. */
export const getClarifyCalls = (
	rawCalls: RawToolCall[],
	decision: FoodParseDecision,
): ClarifyCall[] => {
	const kept = decision.kind === 'log' ? decision.clarifications : []
	return rawCalls
		.filter((call) => call.name === 'clarify')
		.flatMap((call) => {
			const parsed = clarifyInputSchema.safeParse(parseArguments(call.arguments))
			if (!parsed.success) return []
			const kcal = parsed.data.options.map((option) => option.kcal)
			return [
				{
					question: parsed.data.question,
					options: parsed.data.options,
					impactKcal: Math.max(...kcal) - Math.min(...kcal),
					kind: parsed.data.kind,
					isKept: kept.some((item) => item.question === parsed.data.question),
				},
			]
		})
}
