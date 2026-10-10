export type ProfileFieldKey =
	| 'sex'
	| 'age'
	| 'heightCm'
	| 'weightKg'
	| 'activityLevel'
	| 'goalType'
	| 'targetWeightKg'
	| 'paceKgPerWeek'

export interface ProfileRow {
	key: ProfileFieldKey
	label: string
	/** null: the page shows «не вказано». */
	value: string | null
}
