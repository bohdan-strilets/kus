import type { GoalType, ProfileGoals, ProfileResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatEta, formatPaceValue, type PlanProfile } from '@/entities/goals'
import { ACTIVITY_LABEL_KEY } from '@/entities/profile'
import type { IconName } from '@/shared/ui'
import { formatDecimal, formatInteger, INTL_LOCALE } from '@/shared/lib'

type ActivityLevel = PlanProfile['activityLevel']

/** «82,4», but «84» for a whole number. */
const formatKg = (kg: number): string =>
	Number.isInteger(kg) ? formatInteger(kg) : formatDecimal(kg, 1)

const capitalize = (text: string): string =>
	text.charAt(0).toLocaleUpperCase(INTL_LOCALE) + text.slice(1)

interface BubbleInput {
	weightKg: number
	activityLevel: ActivityLevel
	goalType: GoalType
	pace: number | null
}

const getBubblePace = ({ goalType, pace }: BubbleInput, t: TFunction): string => {
	if (goalType === 'MAINTAIN' || pace === null) return t('recalcGoals.paceMaintain')
	const key = goalType === 'LOSE' ? 'recalcGoals.paceLose' : 'recalcGoals.paceGain'
	return t(key, { pace: formatPaceValue(pace) })
}

/** «Перерахував під нові дані: 82,4 кг, трохи руху, мінус 0,25 кг на тиждень.» */
export const getRecalcBubbleText = (input: BubbleInput, t: TFunction): string =>
	t('recalcGoals.bubble', {
		weight: formatKg(input.weightKg),
		activity: t(ACTIVITY_LABEL_KEY[input.activityLevel]).toLocaleLowerCase(INTL_LOCALE),
		pace: getBubblePace(input, t),
	})

interface PaceInput {
	goalType: GoalType
	pace: number | null
	targetWeightKg: number | null
	weightKg: number
	etaWeeks: number | null
}

/** The line under the macros: pace and, when there is a target, how long it takes. */
export const getRecalcPaceText = (input: PaceInput, t: TFunction): string => {
	const { goalType, pace, targetWeightKg, weightKg, etaWeeks } = input
	if (goalType === 'MAINTAIN' || pace === null) {
		return t('recalcGoals.etaMaintain', { weight: formatKg(weightKg) })
	}
	const paceValue = formatPaceValue(pace)
	if (targetWeightKg === null || etaWeeks === null) {
		if (goalType === 'LOSE') return t('recalcGoals.etaNoTarget', { pace: paceValue })
		return `${capitalize(t('recalcGoals.paceGain', { pace: paceValue }))}.`
	}
	const key = goalType === 'LOSE' ? 'recalcGoals.etaLose' : 'recalcGoals.etaGain'
	return t(key, {
		pace: paceValue,
		target: formatKg(targetWeightKg),
		eta: formatEta(etaWeeks, t),
	})
}

/** The icon pack has no «up» trend, so a gain shows the same arrow as a loss. */
export const getPaceIcon = (goalType: GoalType): IconName =>
	goalType === 'MAINTAIN' ? 'trend-flat' : 'trend-down'

export const getWasText = (current: ProfileGoals, t: TFunction): string =>
	t('recalcGoals.was', {
		kcal: formatInteger(current.kcal),
		protein: formatInteger(current.proteinG),
		carbs: formatInteger(current.carbsG),
		fat: formatInteger(current.fatG),
	})

/** The profile narrowed to what the calculation needs; null while anything is missing. */
export const toPlanProfile = (response: ProfileResponse): PlanProfile | null => {
	const { profile, weight } = response
	const { sex, age, heightCm, activityLevel, goalType, paceKgPerWeek } = profile
	if (!weight || !sex || age === null || heightCm === null || !activityLevel || !goalType) {
		return null
	}
	return { sex, age, heightCm, weightKg: weight.kg, activityLevel, goalType, paceKgPerWeek }
}
