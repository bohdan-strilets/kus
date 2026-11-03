import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getLiveActionError, useLiveWorkoutActions } from '@/entities/workout'
import { getApiError } from '@/shared/api'
import { getTrainingFillPath, TRAINING_LIVE_ROUTE } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Button, useToast } from '@/shared/ui'

interface StartWorkoutButtonsProps {
	/** The template to follow; null starts an empty session. */
	templateId: string | null
	className?: string
}

/**
 * mockups/training-home.html: [Почати] opens the live session (the server makes it, or returns
 * the one already open) and goes to it; [Заповнити] opens the form for the same template.
 */
export const StartWorkoutButtons = ({ templateId, className }: StartWorkoutButtonsProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const toast = useToast()
	const { start } = useLiveWorkoutActions()

	return (
		<div className={cn('grid grid-cols-2 gap-2', className)}>
			<Button
				isLoading={start.isPending}
				onClick={() => {
					start.mutate(templateId, {
						onSuccess: () => {
							void navigate(TRAINING_LIVE_ROUTE)
						},
						onError: (error) => {
							toast.show(getLiveActionError(getApiError(error), t))
						},
					})
				}}
			>
				{t('training.start.begin')}
			</Button>
			<Button
				variant="secondary"
				onClick={() => {
					void navigate(getTrainingFillPath(templateId))
				}}
			>
				{t('training.start.fill')}
			</Button>
		</div>
	)
}
