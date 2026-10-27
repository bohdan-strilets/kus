import type { EvalCase } from './case.types.js'
import { CATEGORY_CASES } from './category.cases.js'
import { DATE_CASES } from './date.cases.js'
import { DAY_CARD_CASES } from './day-card.cases.js'
import { HISTORY_CARD_CASES } from './history-cards.cases.js'
import { DAY_CASES } from './day.cases.js'
import { DECISION_CASES } from './decision.cases.js'
import { EDIT_CASES } from './edit.cases.js'
import { EXACT_CASES } from './exact.cases.js'
import { FOREIGN_VOICE_CASES } from './foreign-voices.cases.js'
import { MEAL_TYPE_CASES } from './meal-type.cases.js'
import { MEASUREMENT_CASES } from './measurement.cases.js'
import { MEMORY_OVERRIDE_CASES } from './memory-override.cases.js'
import { loadHoldoutCases, loadPrivateCases } from './private-cases.js'
import { RANGE_CASES } from './range.cases.js'
import { SAFETY_CASES } from './safety.cases.js'

export type {
	EvalCase,
	ExpectedDecision,
	ExpectedDeletedMeasurement,
	ExpectedEdits,
	ExpectedMeasurement,
	ExpectedValue,
} from './case.types.js'

export const REPO_CASES: EvalCase[] = [
	...EXACT_CASES,
	...RANGE_CASES,
	...CATEGORY_CASES,
	...DECISION_CASES,
	...DAY_CASES,
	...MEAL_TYPE_CASES,
	...MEMORY_OVERRIDE_CASES,
	...EDIT_CASES,
	...MEASUREMENT_CASES,
	...DATE_CASES,
	...DAY_CARD_CASES,
	...HISTORY_CARD_CASES,
	...FOREIGN_VOICE_CASES,
	...SAFETY_CASES,
]

/** Written, but need a context the contract doesn't have yet; not run until it does. None now. */
export const PENDING_CASES: EvalCase[] = []

export const loadCases = async (): Promise<EvalCase[]> => [
	...REPO_CASES,
	...(await loadPrivateCases()),
]

/** Never part of loadCases: the prompt is not tuned on the hold-out set. */
export { loadHoldoutCases }
