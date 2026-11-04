import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/shared/ui'

import { removeFormSet, restoreFormSet } from '../lib/form-exercise-edit'
import type { FormExerciseValue } from '../lib/workout-form.types'

/**
 * Deleting a set in the form's table (mockups/training-form.html): gone at once, the toast
 * «Підхід 3 видалено» brings it back. Local state only, nothing is sent before «Зберегти». The
 * undo reads the newest exercise, so edits made while the toast hung are kept.
 */
export const useFormSetRemoval = (
	exercise: FormExerciseValue,
	onChange: (exercise: FormExerciseValue) => void,
): ((setIndex: number) => void) => {
	const { t } = useTranslation()
	const toast = useToast()
	const latest = useRef({ exercise, onChange })
	const isMounted = useRef(true)
	useEffect(() => {
		latest.current = { exercise, onChange }
	})
	useEffect(() => {
		isMounted.current = true
		return () => {
			isMounted.current = false
		}
	}, [])

	return (setIndex) => {
		const set = exercise.sets[setIndex]
		if (!set) return
		onChange(removeFormSet(exercise, setIndex))
		// the undo is one-shot: a second press in the toast's exit animation adds nothing
		let isUndone = false
		toast.show(
			set.isWarmup ? t('workout.warmupDeleted') : t('workout.setDeleted', { n: setIndex + 1 }),
			{
				action: {
					label: t('workout.undo'),
					onClick: () => {
						if (isUndone || !isMounted.current) return
						isUndone = true
						const { exercise: newest, onChange: change } = latest.current
						change(restoreFormSet(newest, setIndex, set))
					},
				},
			},
		)
	}
}
