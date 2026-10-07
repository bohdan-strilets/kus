import type { EvalCase } from './case.types.js'
import { CATEGORY_CASES } from './category.cases.js'
import { DECISION_CASES } from './decision.cases.js'
import { EXACT_CASES } from './exact.cases.js'
import { loadPrivateCases } from './private-cases.js'
import { RANGE_CASES } from './range.cases.js'

export type { EvalCase, ExpectedDecision, ExpectedValue } from './case.types.js'

export const REPO_CASES: EvalCase[] = [
	...EXACT_CASES,
	...RANGE_CASES,
	...CATEGORY_CASES,
	...DECISION_CASES,
]

export const loadCases = async (): Promise<EvalCase[]> => [
	...REPO_CASES,
	...(await loadPrivateCases()),
]
