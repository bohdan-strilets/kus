import type { ProfileResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDecimal } from '@/shared/lib'

import type { ProfileRow } from '../model/profile-field.types'
import {
	ACTIVITY_LABEL_KEY,
	formatPace,
	GOAL_TYPE_LABEL_KEY,
	SEX_LABEL_KEY,
} from './profile-labels'

export interface ProfileRows {
	body: ProfileRow[]
	goal: ProfileRow[]
}

export const getProfileRows = (profile: ProfileResponse, t: TFunction): ProfileRows => {
	const { sex, age, heightCm, activityLevel, goalType, targetWeightKg, paceKgPerWeek } =
		profile.profile
	const weightKg = profile.weight?.kg ?? null

	const formatKg = (kg: number | null): string | null =>
		kg === null ? null : t('profile.data.values.kg', { value: formatDecimal(kg, 1) })

	const body: ProfileRow[] = [
		{
			key: 'sex',
			label: t('profile.data.fields.sex'),
			value: sex === null ? null : t(SEX_LABEL_KEY[sex]),
		},
		{
			key: 'age',
			label: t('profile.data.fields.age'),
			value: age === null ? null : t('profile.data.values.age', { count: age }),
		},
		{
			key: 'heightCm',
			label: t('profile.data.fields.heightCm'),
			value: heightCm === null ? null : t('profile.data.values.cm', { value: heightCm }),
		},
		{ key: 'weightKg', label: t('profile.data.fields.weightKg'), value: formatKg(weightKg) },
		{
			key: 'activityLevel',
			label: t('profile.data.fields.activityLevel'),
			value: activityLevel === null ? null : t(ACTIVITY_LABEL_KEY[activityLevel]),
		},
	]

	const goal: ProfileRow[] = [
		{
			key: 'goalType',
			label: t('profile.data.fields.goalType'),
			value: goalType === null ? null : t(GOAL_TYPE_LABEL_KEY[goalType]),
		},
		{
			key: 'targetWeightKg',
			label: t('profile.data.fields.targetWeightKg'),
			value: formatKg(targetWeightKg),
		},
	]

	// maintaining has no pace: the row would only say «не вказано»
	if (goalType !== 'MAINTAIN') {
		goal.push({
			key: 'paceKgPerWeek',
			label: t('profile.data.fields.paceKgPerWeek'),
			value:
				paceKgPerWeek === null || goalType === null
					? null
					: t('profile.data.values.pace', { pace: formatPace(paceKgPerWeek, goalType) }),
		})
	}

	return { body, goal }
}
