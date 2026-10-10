import type { TFunction } from 'i18next'

const WEEKS_PER_MONTH = 4.33
const MAX_WEEKS_SHOWN = 8

/** «5 тижнів» up to two months, then «4 місяці». */
export const formatEta = (etaWeeks: number, t: TFunction): string => {
	if (etaWeeks < MAX_WEEKS_SHOWN) return t('recalcGoals.weeks', { count: Math.round(etaWeeks) })
	return t('recalcGoals.months', { count: Math.max(1, Math.round(etaWeeks / WEEKS_PER_MONTH)) })
}
