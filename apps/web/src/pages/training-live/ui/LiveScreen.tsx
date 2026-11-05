import {
	type LiveWorkoutResponse,
	MAX_EXERCISES_PER_WORKOUT,
	type WorkoutFinished,
} from '@kus/shared'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ExercisePickerSheet, formatWorkoutMinutes } from '@/entities/workout'
import {
	ClosedByChatCard,
	countDoneSets,
	findNextTodoAfter,
	ExitWorkoutDialog,
	getElapsedMinutes,
	isExerciseDone,
	SyncNotice,
	useLiveSession,
	useRestTimer,
	useLiveWorkoutStore,
} from '@/features/live-workout'
import { getTrainingSessionPath } from '@/shared/config'
import { useWakeLock } from '@/shared/lib'
import {
	Button,
	countSwipeRowsBefore,
	DashedAction,
	Icon,
	ICON_SIZE,
	IconButton,
	useSwipeFocus,
} from '@/shared/ui'

import { useLiveExit } from '../model/use-live-exit'
import { LiveExerciseBar, type LiveBarSegment } from './LiveExerciseBar'
import { LiveExerciseList } from './LiveExerciseList'
import { LiveHeader } from './LiveHeader'
import { RestTimerPanel } from './RestTimerPanel'

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
	const isReduced = useReducedMotion() === true
	const session = useLiveSession(live)
	const { draft, current, sync } = session
	const [isPickerOpen, setIsPickerOpen] = useState(false)
	// the rest sheet lies over the content: the content keeps this much room under it
	const [restPanelHeight, setRestPanelHeight] = useState(0)
	const restTimer = useRestTimer(draft, current)
	const wakeLock = useWakeLock(restTimer.state.status === 'running')
	const doneSets = countDoneSets(draft)
	const exercisesRef = useRef<HTMLDivElement>(null)
	const addExerciseRef = useRef<HTMLButtonElement>(null)
	const rememberFocus = useSwipeFocus(exercisesRef, () => addExerciseRef.current)
	const deleteExercise = (index: number, origin: Element | null): void => {
		if (exercisesRef.current && origin) {
			rememberFocus(countSwipeRowsBefore(exercisesRef.current, origin))
		}
		session.deleteExercise(index)
	}
	const exit = useLiveExit({
		workoutId: draft.workoutId,
		whenIdle: sync.whenIdle,
		onFinished,
	})

	// our own «Завершити» / «Вийти» empties the cache too: that is not a close from the chat
	const isSessionClosed = (isClosed || sync.closedByChat) && !exit.isClosingMyself
	// nothing of a closed session is written any more: its unsent sets go
	useEffect(() => {
		if (!isSessionClosed) return
		const { clearSnapshot, clearLastSeen } = useLiveWorkoutStore.getState()
		clearSnapshot(draft.workoutId)
		clearLastSeen()
	}, [isSessionClosed, draft.workoutId])

	const focusIndex = current?.exerciseIndex ?? -1
	const exerciseCount = draft.exercises.length
	const lastFocusRef = useRef({ focusIndex, exerciseCount })
	// design/docs/motion.md «Живий режим» п. 3: when the hand moves to another exercise, its title
	// scrolls into view and takes the focus
	useEffect(() => {
		const last = lastFocusRef.current
		lastFocusRef.current = { focusIndex, exerciseCount }
		// a deleted exercise hands the focus over by itself (useSwipeFocus)
		if (last.focusIndex === focusIndex || exerciseCount < last.exerciseCount) return
		const title = exercisesRef.current?.querySelector<HTMLElement>('[data-live-exercise-title]')
		if (!title) return
		// jsdom has no scrollIntoView
		if (typeof title.scrollIntoView === 'function') {
			title.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'start' })
		}
		title.focus({ preventScroll: true })
	}, [focusIndex, exerciseCount, isReduced])

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

	const nextIndex = findNextTodoAfter(draft, focusIndex)?.exerciseIndex ?? -1
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
		<div className="relative flex min-h-0 flex-1 flex-col">
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
			{/* layoutScroll: the rows glide inside a scrolling parent, Motion has to know its scroll */}
			<motion.div layoutScroll className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4">
				<LiveExerciseBar segments={segments} />
				<div ref={exercisesRef} className="flex flex-col gap-2 px-gutter">
					<LiveExerciseList
						draft={draft}
						session={session}
						focusIndex={focusIndex}
						nextIndex={nextIndex}
						onDeleteExercise={deleteExercise}
					/>
					<DashedAction
						ref={addExerciseRef}
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
				{/* the rest sheet covers the bottom of the list: this room keeps «+ Підхід» and the basket reachable */}
				{restPanelHeight > 0 ? (
					<div aria-hidden="true" className="flex-none" style={{ height: restPanelHeight }} />
				) : (
					<div aria-hidden="true" className="flex-none pb-safe-bottom" />
				)}
			</motion.div>
			<RestTimerPanel
				timer={restTimer}
				onHeightChange={setRestPanelHeight}
				isWakeLockUnavailable={wakeLock.isUnavailable}
			/>
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
