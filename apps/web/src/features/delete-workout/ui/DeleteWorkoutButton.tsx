import type { WorkoutResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, ConfirmDialog, Icon } from '@/shared/ui'

import { formatWorkoutName } from '../lib/format-workout-name'
import { useDeleteWorkout } from '../model/use-delete-workout'

const TRASH_ICON_SIZE = 14

export interface DeleteWorkoutButtonProps {
	workout: WorkoutResponse
	/** The training is deleted: the screen that showed it goes back. */
	onDeleted?: () => void
}

/** «Видалити тренування» under the session: confirm, then delete (mockups/training-session.html). */
export const DeleteWorkoutButton = ({ workout, onDeleted }: DeleteWorkoutButtonProps) => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const { remove, isDeleting } = useDeleteWorkout({
		onDeleted,
		onSettled: () => {
			setIsOpen(false)
		},
	})
	const name = formatWorkoutName(workout, t)

	return (
		<>
			<Button
				variant="textDanger"
				size="md"
				className="min-h-tap"
				icon={<Icon name="trash" size={TRASH_ICON_SIZE} />}
				aria-label={t('workout.delete.ariaLabel', { name })}
				aria-haspopup="dialog"
				onClick={() => {
					setIsOpen(true)
				}}
			>
				{t('workout.delete.screenAction')}
			</Button>
			<ConfirmDialog
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				title={t('workout.delete.title')}
				description={t('workout.delete.text', { name })}
				cancelLabel={t('workout.delete.cancel')}
				confirmLabel={t('workout.delete.confirm')}
				isConfirmLoading={isDeleting}
				onConfirm={() => {
					remove(workout.id)
				}}
			/>
		</>
	)
}
