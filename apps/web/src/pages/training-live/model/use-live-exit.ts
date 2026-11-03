import type { WorkoutFinished } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getLiveActionError, useLiveWorkoutActions } from '@/entities/workout'
import { useLiveWorkoutStore, type LiveSyncStatus } from '@/features/live-workout'
import { getApiError } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { useStackBack } from '@/shared/lib'
import { useToast } from '@/shared/ui'

interface UseLiveExit {
	isExitOpen: boolean
	setIsExitOpen: (isOpen: boolean) => void
	isFinishing: boolean
	isDiscarding: boolean
	/** Set before the close request is sent: the live cache empties by our own hand, not the chat's. */
	isClosingMyself: boolean
	/** «Згорнути»: just leaves, the session stays open on the server. */
	leave: () => void
	finish: () => Promise<void>
	discard: () => void
}

/**
 * How the live screen ends: «Згорнути» (the session stays open on the server), «Завершити» (the
 * summary, or — with no set done — «Нічого не записано» and back to the tab) and «Вийти без
 * збереження» (asks first). «Завершити» waits while sets are still on their way, so none is lost.
 */
export const useLiveExit = ({
	workoutId,
	whenIdle,
	onFinished,
}: {
	workoutId: string
	/** Resolves when every set is on the server, or tells why it is stuck. */
	whenIdle: () => Promise<LiveSyncStatus>
	/** The summary the server wrote: the page shows it instead of the session. */
	onFinished: (finished: WorkoutFinished) => void
}): UseLiveExit => {
	const { t } = useTranslation()
	const toast = useToast()
	const navigate = useNavigate()
	const leave = useStackBack(ROUTES.training)
	const { finish: finishAction, discard: discardAction } = useLiveWorkoutActions()
	const [isExitOpen, setIsExitOpen] = useState(false)
	const [isWaiting, setIsWaiting] = useState(false)
	const [isClosingMyself, setIsClosingMyself] = useState(false)
	const clearSnapshot = (): void => {
		useLiveWorkoutStore.getState().clearSnapshot(workoutId)
	}

	const finish = async (): Promise<void> => {
		if (isWaiting || finishAction.isPending) return
		setIsWaiting(true)
		try {
			// the last sets may still be on their way: the session is finished after they landed
			const status = await whenIdle()
			if (status === 'offline' || status === 'error') {
				toast.show(status === 'offline' ? t('training.live.offline') : t('training.live.syncError'))
				return
			}
			setIsClosingMyself(true)
			await finishAction.mutateAsync(workoutId).then(
				(data) => {
					clearSnapshot()
					if ('discarded' in data && data.discarded) {
						toast.show(t('training.live.discarded'))
						void navigate(ROUTES.training, { replace: true })
						return
					}
					if ('workout' in data) onFinished(data)
				},
				(error: unknown) => {
					setIsClosingMyself(false)
					toast.show(getLiveActionError(getApiError(error), t))
				},
			)
		} finally {
			setIsWaiting(false)
		}
	}

	const discard = (): void => {
		setIsClosingMyself(true)
		discardAction.mutate(workoutId, {
			onSuccess: () => {
				clearSnapshot()
				void navigate(ROUTES.training, { replace: true })
			},
			onError: (error) => {
				setIsClosingMyself(false)
				toast.show(getLiveActionError(getApiError(error), t))
			},
		})
	}

	return {
		isExitOpen,
		setIsExitOpen,
		isFinishing: finishAction.isPending || isWaiting,
		isDiscarding: discardAction.isPending,
		isClosingMyself,
		leave,
		finish,
		discard,
	}
}
