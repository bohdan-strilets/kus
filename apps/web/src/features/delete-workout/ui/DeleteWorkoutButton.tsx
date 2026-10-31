import type { WorkoutResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOverlayHold, useOverlayOpen } from '@/shared/lib'
import { Button, ConfirmDialog, Icon } from '@/shared/ui'

import { formatWorkoutName } from '../lib/format-workout-name'
import { useDeleteWorkout } from '../model/use-delete-workout'

const TRASH_ICON_SIZE = 14

export interface DeleteWorkoutButtonProps {
	workout: WorkoutResponse
	/** card: «Видалити» in the footer of a chat card; screen: «Видалити тренування» under the session. */
	placement?: 'card' | 'screen'
	/** The training is deleted: the screen that showed it goes back. */
	onDeleted?: () => void
}

/** Confirm, then delete (mockups/chat-workout.html card footer, mockups/training-session.html screen). */
export const DeleteWorkoutButton = ({
	workout,
	placement = 'card',
	onDeleted,
}: DeleteWorkoutButtonProps) => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const { remove, isDeleting } = useDeleteWorkout({
		onDeleted,
		onSettled: () => {
			setIsOpen(false)
		},
	})
	// The dialog covers the chat feed; once it closes the card is still to turn into a line, and that
	// change of height must not unpin a feed that was at the end. So the feed is held until the delete
	// and the refetch are done (the card unmounts when it changes), OVERLAY_HOLD_MAX_MS at most.
	useOverlayOpen(isOpen)
	useOverlayHold(isDeleting)
	const isScreen = placement === 'screen'
	const name = formatWorkoutName(workout, t, { placement })

	return (
		<>
			<Button
				variant={isScreen ? 'textDanger' : 'secondary'}
				size={isScreen ? 'md' : 'sm'}
				className={isScreen ? 'min-h-tap' : 'text-danger'}
				icon={<Icon name="trash" size={TRASH_ICON_SIZE} />}
				aria-label={t('workout.delete.ariaLabel', { name })}
				aria-haspopup="dialog"
				onClick={() => {
					setIsOpen(true)
				}}
			>
				{t(isScreen ? 'workout.delete.screenAction' : 'workout.delete.action')}
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
