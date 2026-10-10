import {
	FAT_G_PER_KG,
	type GoalsPreviewResponse,
	KCAL_FLOOR,
	KCAL_ROUNDING_STEP,
	PROTEIN_G_PER_KG_TARGET,
} from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal, formatInteger, INTL_LOCALE } from '@/shared/lib'

import type { PlanProfile, PlanStep, PlanStepsInput } from '../model/plan-step.types'
import { ACTIVITY_LABEL_KEY } from './activity-label-key'
import { formatPaceValue } from './format-pace-value'

const MULTIPLIER_DIGITS = 3
const PROTEIN_DIGITS = 1
const FAT_DIGITS = 2

/** «1,375», «1,2»: up to three digits, no trailing zeros. */
const formatMultiplier = (multiplier: number): string =>
	multiplier.toLocaleString(INTL_LOCALE, { maximumFractionDigits: MULTIPLIER_DIGITS })

/** «82,4», but «84» for a whole number. */
const formatWeight = (kg: number): string =>
	Number.isInteger(kg) ? formatInteger(kg) : formatDecimal(kg, 1)

interface StepContext {
	preview: GoalsPreviewResponse
	profile: PlanProfile
	t: TFunction
}

const getBmrStep = ({ preview, profile, t }: StepContext): PlanStep => ({
	title: t('planHow.steps.bmr.title'),
	formula: t('planHow.steps.bmr.formula', {
		weight: formatWeight(profile.weightKg),
		height: formatInteger(profile.heightCm),
		age: profile.age,
		sexTerm: t(`planHow.sexTerm.${profile.sex}`),
	}),
	value: formatInteger(preview.steps.bmr),
})

const getTdeeStep = ({ preview, profile, t }: StepContext): PlanStep => ({
	title: t('planHow.steps.tdee.title'),
	formula: t('planHow.steps.tdee.formula', {
		bmr: formatInteger(preview.steps.bmr),
		multiplier: formatMultiplier(preview.steps.activityMultiplier),
		activity: t(ACTIVITY_LABEL_KEY[profile.activityLevel]).toLocaleLowerCase(INTL_LOCALE),
	}),
	value: formatInteger(preview.steps.tdee),
})

const getAdjustFormula = ({ preview, profile, t }: StepContext): string => {
	const { steps, appliedPaceKgPerWeek, kcal } = preview
	const params = {
		pace: formatPaceValue(appliedPaceKgPerWeek ?? 0),
		tdee: formatInteger(steps.tdee),
		adjustment: formatInteger(Math.abs(steps.adjustmentKcal)),
		raw: formatInteger(steps.rawKcal),
		step: KCAL_ROUNDING_STEP,
		kcal: formatInteger(kcal),
	}
	if (profile.goalType === 'LOSE') return t('planHow.steps.adjust.formulaLose', params)
	if (profile.goalType === 'GAIN') return t('planHow.steps.adjust.formulaGain', params)
	return t('planHow.steps.adjust.formulaMaintain', params)
}

const getAdjustStep = (context: StepContext): PlanStep => {
	const { preview, profile, t } = context
	const floorSuffix = preview.warnings.includes('KCAL_FLOOR_APPLIED')
		? t('planHow.steps.adjust.floorSuffix', { floor: formatInteger(KCAL_FLOOR[profile.sex]) })
		: ''
	return {
		title: t(`planHow.steps.adjust.title.${profile.goalType}`),
		formula: `${getAdjustFormula(context)}${floorSuffix}`,
		value: formatInteger(preview.kcal),
	}
}

const getMacrosStep = ({ preview, t }: StepContext): PlanStep => ({
	title: t('planHow.steps.macros.title'),
	formula: t('planHow.steps.macros.formula', {
		protein: formatDecimal(PROTEIN_G_PER_KG_TARGET, PROTEIN_DIGITS),
		fat: formatDecimal(FAT_G_PER_KG, FAT_DIGITS),
	}),
	value: t('planHow.steps.macros.value', {
		protein: formatInteger(preview.proteinG),
		fat: formatInteger(preview.fatG),
	}),
})

const getCarbsStep = ({ preview, t }: StepContext): PlanStep => ({
	title: t('planHow.steps.carbs.title'),
	formula: t('planHow.steps.carbs.formula'),
	value: t('planHow.steps.carbs.value', { value: formatInteger(preview.carbsG) }),
})

/** «Як я порахував»: the five steps of the calculation, in the order of the mockup. */
export const getPlanSteps = ({
	preview,
	profile,
	t,
}: PlanStepsInput & { t: TFunction }): PlanStep[] => {
	const context: StepContext = { preview, profile, t }
	return [
		getBmrStep(context),
		getTdeeStep(context),
		getAdjustStep(context),
		getMacrosStep(context),
		getCarbsStep(context),
	]
}
