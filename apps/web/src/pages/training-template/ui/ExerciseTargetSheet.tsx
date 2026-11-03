import type { TemplateExerciseTarget } from '@kus/shared'
import { useState } from 'react'

import { BaseBottomSheet } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'
import { TargetForm } from './TargetForm'

interface ExerciseTargetSheetProps {
	/** The exercise being set up; null closes the sheet. */
	exercise: DraftExercise | null
	onClose: () => void
	onSave: (key: string, target: TemplateExerciseTarget, isBodyweight: boolean | null) => void
	onRemove: (key: string) => void
}

/** «Ціль вправи» (mockups/training-program.html): the sheet of one exercise, applied to the page's draft. */
export const ExerciseTargetSheet = ({
	exercise,
	onClose,
	onSave,
	onRemove,
}: ExerciseTargetSheetProps) => {
	// the sheet slides away over several frames: it keeps the last exercise to show meanwhile
	const [shown, setShown] = useState(exercise)
	if (exercise && exercise !== shown) setShown(exercise)

	return (
		<BaseBottomSheet
			isOpen={exercise !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
			title={shown?.name ?? ''}
		>
			{shown && (
				<TargetForm
					key={shown.key}
					exercise={shown}
					onSave={(target, isBodyweight) => {
						onSave(shown.key, target, isBodyweight)
					}}
					onRemove={() => {
						onRemove(shown.key)
					}}
				/>
			)}
		</BaseBottomSheet>
	)
}
