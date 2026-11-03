import {
	type LiveWorkoutResponse,
	MAX_EXERCISES_PER_WORKOUT,
	type WorkoutFinished,
} from '@kus/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ExercisePickerSheet, formatWorkoutMinutes } from '@/entities/workout'
import {
	ClosedByChatCard,
	countDoneSets,
	ExitWorkoutDialog,
	getElapsedMinutes,
	isExerciseDone,
	SyncNotice,
	useLiveSession,
	useLiveWorkoutStore,
} from '@/features/live-workout'
import { getTrainingSessionPath } from '@/shared/config'
import { Button, DashedAction, Icon, ICON_SIZE, IconButton } from '@/shared/ui'

import { useLiveExit } from '../model/use-live-exit'
import { LiveCardio } from './LiveCardio'
import { LiveExercise } from './LiveExercise'
import { LiveExerciseBar, type LiveBarSegment } from './LiveExerciseBar'
import { LiveExerciseRow } from './LiveExerciseRow'
import { LiveHeader } from './LiveHeader'

/**
 * mockups/training-live.html: the full screen of an open session (no bottom nav). One exercise is
 * in hand with its sets; the rest are rows. Everything the person does goes to the server through
 * the sync; the chat's exercises are shown and never edited here.
 */
interface LiveScreenProps {
	live: LiveWorkoutResponse
	onFinished: (finished: WorkoutFinished) => void
	/** The session was closed elsewhere (the chat) and the server no longer has it open. */
	isClosed: boolean
}

export const LiveScreen = ({ live, onFinished, isClosed }: LiveScreenProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const session = useLiveSession(live)
	const { draft, current, sync } = session
	const [isPickerOpen, setIsPickerOpen] = useState(false)
	const doneSets = countDoneSets(draft)
	const exit = useLiveExit({
		workoutId: draft.workoutId,
		whenIdle: sync.whenIdle,
		onFinished,
	})

	// our own «Завершити» / «Вийти» empties the cache too: that is not a close from the chat
	const isSessionClosed = (isClosed || sync.closedByChat) && !exit.isClosingMyself
	// nothing of a closed session is written any more: its unsent sets go
	useEffect(() => {
		if (isSessionClosed) useLiveWorkoutStore.getState().clearSnapshot(draft.workoutId)
	}, [isSessionClosed, draft.workoutId])

	if (isSessionClosed) {
		return (
			<div className="flex min-h-0 flex-1 flex-col gap-3 pt-5.5">
				<div className="px-gutter">
					<IconButton label={t('training.live.minimize')} variant="frosted" onClick={exit.leave}>
						<Icon name="chevron-down" size={ICON_SIZE.nav} />
					</IconButton>
				</div>
				<ClosedByChatCard
					onOpen={() => {
						void navigate(getTrainingSessionPath(draft.workoutId), { replace: true })
					}}
				/>
			</div>
		)
	}

	const focusIndex = current?.exerciseIndex ?? -1
	const nextIndex = draft.exercises.findIndex(
		(exercise, index) => index > focusIndex && !exercise.readOnly && !isExerciseDone(exercise),
	)
	const segments = draft.exercises.map((exercise, index): LiveBarSegment => {
		if (index === focusIndex) return 'current'
		return isExerciseDone(exercise) ? 'done' : 'todo'
	})
	const minutes = formatWorkoutMinutes(getElapsedMinutes(draft.startedAt, new Date()), t)
	const summary =
		doneSets === 0
			? null
			: t('training.live.exit.summary', {
					sets: t('workout.setCountFull', { count: doneSets }),
					minutes,
				})

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<LiveHeader
				name={draft.templateName ?? t('training.live.defaultName')}
				startedAt={draft.startedAt}
				isFinishing={exit.isFinishing}
				onMinimize={exit.leave}
				onFinish={() => {
					void exit.finish()
				}}
			/>
			<SyncNotice status={sync.status} onRetry={sync.retry} />
			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4">
				<LiveExerciseBar segments={segments} />
				<div className="flex flex-col gap-2 px-gutter">
					{draft.exercises.map((exercise, index) => {
						if (index === focusIndex) {
							return exercise.kind === 'CARDIO' ? (
								<LiveCardio
									key={exercise.rowKey}
									exercise={exercise}
									exerciseIndex={index}
									session={session}
								/>
							) : (
								<LiveExercise
									key={exercise.rowKey}
									exercise={exercise}
									exerciseIndex={index}
									session={session}
								/>
							)
						}
						return (
							<LiveExerciseRow
								key={exercise.rowKey}
								exercise={exercise}
								isNext={index === nextIndex}
								onSelect={
									exercise.readOnly
										? null
										: () => {
												session.selectExercise(index)
											}
								}
							/>
						)
					})}
					<DashedAction
						isDisabled={draft.exercises.length >= MAX_EXERCISES_PER_WORKOUT}
						onClick={() => {
							setIsPickerOpen(true)
						}}
					>
						{t('program.editor.addExercise')}
					</DashedAction>
					<Button
						variant="textDanger"
						onClick={() => {
							exit.setIsExitOpen(true)
						}}
					>
						{t('training.live.exit.discard')}
					</Button>
				</div>
			</div>
			<ExercisePickerSheet
				isOpen={isPickerOpen}
				onOpenChange={setIsPickerOpen}
				onPick={(pick) => {
					session.addExercise(pick)
					setIsPickerOpen(false)
				}}
			/>
			<ExitWorkoutDialog
				isOpen={exit.isExitOpen}
				onOpenChange={exit.setIsExitOpen}
				summary={summary}
				isDiscarding={exit.isDiscarding}
				onDiscard={exit.discard}
			/>
		</div>
	)
}
