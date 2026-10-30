import type { WorkoutResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOverlayHold, useOverlayOpen } from '@/shared/lib'
import { Button, ConfirmDialog, Icon } from '@/shared/ui'

import { formatWorkoutName } from '../lib/format-workout-name'
import { useDeleteWorkout } from '../model/use-delete-workout'

const TRASH_ICON_SIZE = 14

/** «Видалити» in the footer of a workout card (mockups/chat-workout.html): confirm, then delete. */
export const DeleteWorkoutButton = ({ workout }: { workout: WorkoutResponse }) => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const { remove, isDeleting } = useDeleteWorkout({
		onSettled: () => {
			setIsOpen(false)
		},
	})
	// The dialog covers the chat feed; once it closes the card is still to turn into a line, and that
	// change of height must not unpin a feed that was at the end. So the feed is held until the delete
	// and the refetch are done (the card unmounts when it changes), OVERLAY_HOLD_MAX_MS at most.
	useOverlayOpen(isOpen)
	useOverlayHold(isDeleting)
	const name = formatWorkoutName(workout, t)

	return (
		<>
			<Button
				variant="secondary"
				size="sm"
				className="text-danger"
				icon={<Icon name="trash" size={TRASH_ICON_SIZE} />}
				aria-label={t('workout.delete.ariaLabel', { name })}
				aria-haspopup="dialog"
				onClick={() => {
					setIsOpen(true)
				}}
			>
				{t('workout.delete.action')}
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
