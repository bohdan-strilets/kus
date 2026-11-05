import type { TFunction } from 'i18next'

import { getChangedSetNumbers, getPlanCountChange } from './build-form-draft'
import { formatPlanSummary } from './format-plan-summary'
import type { FormExerciseValue } from './workout-form.types'

/** Which text says «number and values changed»; the other one (`changedCountWithPlan`) is the shorter fallback. */
const CHANGED_BOTH_KEY = 'training.form.changedBoth'

/** «2-й і 3-й»: the changed sets as ordinals, the last one joined with «і». */
const formatChangedSets = (numbers: readonly number[], t: TFunction): string => {
	const ordinals = numbers.map((n) => t('training.form.setOrdinal', { n }))
	const last = ordinals[ordinals.length - 1] ?? ''
	return ordinals.length <= 1
		? last
		: `${ordinals.slice(0, -1).join(', ')} ${t('training.form.and')} ${last}`
}

/**
 * «Змінено: 2 підходи замість 3», «Змінено: 2-й підхід · план: …»: what differs from the plan
 * (null: nothing to say, or a cardio/added exercise that has no sets to compare).
 */
export const formatChangeLine = (exercise: FormExerciseValue, t: TFunction): string | null => {
	if (exercise.plan === null || exercise.kind === 'CARDIO') return null
	const plan = formatPlanSummary(exercise, t) ?? ''
	const changed = getChangedSetNumbers(exercise)
	const countChange = getPlanCountChange(exercise)
	const hasWorkingSets = exercise.sets.some((set) => !set.isWarmup)
	if (!hasWorkingSets) return t('training.form.changedNoSets', { plan })
	const count = countChange
		? t('training.form.changedCount', {
				sets: t('workout.setCountFull', { count: countChange.actual }),
				planned: countChange.planned,
			})
		: null
	const sets =
		changed.length > 0
			? t('training.form.changedSets', {
					count: changed.length,
					list: formatChangedSets(changed, t),
				})
			: null
	if (count !== null && sets !== null) return t(CHANGED_BOTH_KEY, { count, sets, plan })
	if (count !== null) return t('training.form.changedOnlyCount', { count })
	if (sets !== null) return t('training.form.changed', { sets, plan })
	return null
}
