import { MAX_SETS_PER_EXERCISE } from '@kus/shared'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { SetFields, SetRow, SetTable } from '@/entities/workout'
import {
	getWeightStepKg,
	getWorkingNumber,
	isBodyweightExercise,
	type LiveDraftExercise,
	type LiveSession,
} from '@/features/live-workout'
import {
	Button,
	countSwipeRowsBefore,
	Icon,
	ICON_SIZE,
	IconButton,
	SWIPE_ROWS_ANYWHERE,
	SwipeGroup,
	SwipeToDelete,
	useSwipeFocus,
} from '@/shared/ui'

import { SetDoneToggle } from './SetDoneToggle'

interface LiveSetListProps {
	exercise: LiveDraftExercise
	exerciseIndex: number
	session: LiveSession
	/** The basket of the exercise; gets the button, to tell where the focus goes next. */
	onDeleteExercise: (origin: Element | null) => void
}

/** The sets of the current exercise: the one being edited is a block, the others are rows with a ✓. */
export const LiveSetList = ({
	exercise,
	exerciseIndex,
	session,
	onDeleteExercise,
}: LiveSetListProps) => {
	const { t } = useTranslation()
	const { current } = session
	const containerRef = useRef<HTMLDivElement>(null)
	const rememberFocus = useSwipeFocus(
		containerRef,
		() => containerRef.current?.querySelector<HTMLElement>('[data-add-set]') ?? null,
		SWIPE_ROWS_ANYWHERE,
	)
	const isBodyweight = isBodyweightExercise(exercise)
	const isAtLimit = exercise.sets.length >= MAX_SETS_PER_EXERCISE

	return (
		<div ref={containerRef} className="flex flex-col gap-2">
			<SwipeGroup>
				<SetTable hasWeight={!isBodyweight}>
					{exercise.sets.map((set, setIndex) => {
						const ref = { exerciseIndex, setIndex }
						const number = String(getWorkingNumber(exercise, setIndex))
						const rowLabel = set.isWarmup ? t('workout.warmupShort') : number
						const deleteLabel = set.isWarmup
							? t('workout.deleteWarmupAria')
							: t('workout.deleteSetAria', { n: number })
						const isCurrent =
							current?.exerciseIndex === exerciseIndex && current.setIndex === setIndex
						if (isCurrent && set.doneAt === null) {
							return (
								<SetFields
									key={setIndex}
									title={
										set.isWarmup
											? t('training.live.warmupTitle')
											: t('training.live.setTitle', { n: number })
									}
									titleAriaLabel={
										set.isWarmup ? t('training.live.warmupSetAria', { n: setIndex + 1 }) : undefined
									}
									reps={set.reps}
									weightKg={set.weightKg}
									isBodyweight={isBodyweight}
									weightStepKg={getWeightStepKg(exercise)}
									onChange={(patch) => {
										session.changeSet(ref, patch)
									}}
									deleteLabel={deleteLabel}
									onDelete={() => {
										// only one set is a block, so every set above it is a row
										rememberFocus(setIndex)
										session.deleteSet(ref)
									}}
								>
									<Button
										isFullWidth
										className="min-h-14 bg-success"
										icon={<Icon name="check" size={ICON_SIZE.control} />}
										onClick={() => {
											session.toggleDone(ref)
										}}
									>
										{t('training.live.setDone')}
									</Button>
								</SetFields>
							)
						}
						return (
							<SwipeToDelete
								key={setIndex}
								actionLabel={t('workout.swipeDelete')}
								actionAriaLabel={deleteLabel}
								onAction={(row) => {
									if (containerRef.current && row) {
										rememberFocus(
											countSwipeRowsBefore(containerRef.current, row, SWIPE_ROWS_ANYWHERE),
										)
									}
									session.deleteSet(ref)
								}}
							>
								<SetRow
									label={rowLabel}
									ariaLabel={t('training.live.setEdit', { n: rowLabel })}
									reps={set.reps}
									weightKg={set.weightKg}
									hasWeight={!isBodyweight}
									isWarmup={set.isWarmup}
									isDone={set.doneAt !== null}
									onSelect={() => {
										session.selectSet(ref)
									}}
									trailing={
										<SetDoneToggle
											label={rowLabel}
											isDone={set.doneAt !== null}
											onToggle={() => {
												session.toggleDone(ref)
											}}
										/>
									}
								/>
							</SwipeToDelete>
						)
					})}
				</SetTable>
			</SwipeGroup>
			<div className="flex gap-2 pt-0.5">
				<Button
					variant="secondary"
					className="flex-1"
					data-add-set=""
					disabled={isAtLimit}
					onClick={() => {
						session.addSet(exerciseIndex)
					}}
				>
					{t('training.live.addSet')}
				</Button>
				<Button
					variant="secondary"
					className="flex-1 border-2 border-dashed border-line-strong bg-transparent"
					disabled={isAtLimit}
					onClick={() => {
						session.addWarmup(exerciseIndex)
					}}
				>
					{t('training.live.addWarmup')}
				</Button>
				<IconButton
					label={t('workout.deleteExerciseAria', { name: exercise.name })}
					variant="ghost"
					className="text-muted-strong"
					onClick={(event) => {
						onDeleteExercise(event.currentTarget)
					}}
				>
					<Icon name="trash" size={ICON_SIZE.control} />
				</IconButton>
			</div>
		</div>
	)
}
