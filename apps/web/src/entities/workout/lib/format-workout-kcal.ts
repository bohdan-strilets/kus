import type { WorkoutKcal } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatInteger } from '@/shared/lib'

export type WorkoutKcalKind = 'estimate' | 'named'

export interface WorkoutKcalView {
	/** «≈ 350 ккал» / «380 ккал»: for a plate or an aria label. */
	value: string
	/** «≈ 350 ккал · оцінка» / «380 ккал · зі слів»: the line under a title or in a card. */
	note: string
	/** What `note` adds after `value` (« · оцінка»): the number can be set bold on its own. */
	tail: string
	kind: WorkoutKcalKind
}

const toView = (value: string, note: string, kind: WorkoutKcalKind): WorkoutKcalView => ({
	value,
	note,
	tail: note.startsWith(value) ? note.slice(value.length) : '',
	kind,
})

/**
 * What a screen says about the calories of a workout: the number the person named or a device
 * showed («380 ккал · зі слів», «· з табло»), else the backend's estimate («≈ 350 ккал · оцінка»).
 * Null — no number, and then nothing is shown at all (no placeholder).
 */
export const formatWorkoutKcal = (
	kcal: WorkoutKcal | null,
	t: TFunction,
): WorkoutKcalView | null => {
	if (kcal === null) return null
	const formatted = formatInteger(kcal.value)
	if (kcal.source === 'ESTIMATE') {
		return toView(
			t('workout.kcal.estimateValue', { kcal: formatted }),
			t('workout.kcal.estimateNote', { kcal: formatted }),
			'estimate',
		)
	}
	return toView(
		t('workout.kcal.value', { kcal: formatted }),
		t('workout.kcal.namedNote', {
			kcal: formatted,
			source: t(`workout.kcalSource.${kcal.source}`),
		}),
		'named',
	)
}
