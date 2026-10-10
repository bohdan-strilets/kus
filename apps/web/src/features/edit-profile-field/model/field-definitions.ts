import { PROFILE_LIMITS } from '@kus/shared'

import { GOAL_TYPE_LABEL_KEY, type ProfileFieldKey, SEX_LABEL_KEY } from '@/entities/profile'

import type { FieldDefinition } from './field-definitions.types'

/** How each row of «Мої дані» is edited: the four bodies of mockups/my-data-edit-sheet.html. */
export const FIELD_DEFINITIONS: Record<ProfileFieldKey, FieldDefinition> = {
	sex: {
		kind: 'choice',
		options: [
			{ value: 'MALE', labelKey: SEX_LABEL_KEY.MALE },
			{ value: 'FEMALE', labelKey: SEX_LABEL_KEY.FEMALE },
		],
	},
	goalType: {
		kind: 'choice',
		options: [
			{ value: 'LOSE', labelKey: GOAL_TYPE_LABEL_KEY.LOSE },
			{ value: 'MAINTAIN', labelKey: GOAL_TYPE_LABEL_KEY.MAINTAIN },
			{ value: 'GAIN', labelKey: GOAL_TYPE_LABEL_KEY.GAIN },
		],
	},
	age: {
		kind: 'number',
		inputLabelKey: 'profile.data.edit.labels.age',
		unitKey: 'profile.data.edit.units.years',
		inputMode: 'numeric',
		isInteger: true,
		limits: PROFILE_LIMITS.age,
	},
	heightCm: {
		kind: 'number',
		inputLabelKey: 'profile.data.edit.labels.heightCm',
		unitKey: 'profile.data.edit.units.cm',
		inputMode: 'numeric',
		isInteger: true,
		limits: PROFILE_LIMITS.heightCm,
	},
	weightKg: {
		kind: 'number',
		inputLabelKey: 'profile.data.edit.labels.weightKg',
		unitKey: 'profile.data.edit.units.kg',
		inputMode: 'decimal',
		isInteger: false,
		limits: PROFILE_LIMITS.weightKg,
	},
	targetWeightKg: {
		kind: 'number',
		inputLabelKey: 'profile.data.edit.labels.targetWeightKg',
		unitKey: 'profile.data.edit.units.kg',
		inputMode: 'decimal',
		isInteger: false,
		limits: PROFILE_LIMITS.weightKg,
	},
	activityLevel: { kind: 'activity' },
	paceKgPerWeek: { kind: 'pace' },
}
