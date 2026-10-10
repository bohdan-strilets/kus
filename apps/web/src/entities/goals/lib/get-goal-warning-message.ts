import type { GoalsPreviewResponse, GoalWarning } from '@kus/shared'

import type { ApiMessage } from '@/shared/api'
import { formatInteger } from '@/shared/lib'

import { formatPaceValue } from './format-pace-value'

export const getGoalWarningMessage = (
	warning: GoalWarning,
	preview: GoalsPreviewResponse,
): ApiMessage => {
	if (warning === 'KCAL_FLOOR_APPLIED') {
		return {
			key: 'recalcGoals.warnings.KCAL_FLOOR_APPLIED',
			params: { kcal: formatInteger(preview.kcal) },
		}
	}
	if (warning === 'PACE_LIMITED') {
		return {
			key: 'recalcGoals.warnings.PACE_LIMITED',
			params: { pace: formatPaceValue(preview.appliedPaceKgPerWeek ?? 0) },
		}
	}
	return { key: 'recalcGoals.warnings.MACROS_ADJUSTED' }
}
