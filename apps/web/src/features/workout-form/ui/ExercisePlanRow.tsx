import {
	DEFAULT_PROGRESS_STEP_KG,
	MAX_SETS_PER_EXERCISE,
	PROGRAM_DURATION_MIN_MAX,
} from '@kus/shared'
import type { TFunction } from 'i18next'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	DETAIL_SEPARATOR,
	formatSetReps,
	GroupDot,
	SetFields,
	SetRow,
	SetTable,
} from '@/entities/workout'
import { cn, PRESS, useEnteringKeys } from '@/shared/lib'
import {
	Button,
	countSwipeRowsBefore,
	Icon,
	ICON_SIZE,
	IconButton,
	RowMotion,
	SetStepper,
	SWIPE_ROWS_ANYWHERE,
	SwipeGroup,
	SwipeToDelete,
	Text,
	useSwipeFocus,
} from '@/shared/ui'

import { addFormSet, isFormBodyweight, patchFormSet } from '../lib/form-exercise-edit'
import { formatPlanSummary } from '../lib/format-plan-summary'
import { getChangedSetNumbers, getExerciseState, restorePlan } from '../lib/build-form-draft'
import type { FormExerciseValue } from '../lib/workout-form.types'
import { useFormSetRemoval } from '../model/use-form-set-removal'

interface ExercisePlanRowProps {
	exercise: FormExerciseValue
	onChange: (exercise: FormExerciseValue) => void
	/** An exercise the person added is removed (swipe or the basket); gets the row, for the focus. */
	onRemove: (row: HTMLElement | null) => void
}

const MIN_MINUTES = 1

/** «2-й і 3-й»: the changed sets as ordinals, the last one joined with «і». */
const formatChangedSets = (numbers: readonly number[], t: TFunction): string => {
	const ordinals = numbers.map((n) => t('training.form.setOrdinal', { n }))
	const last = ordinals[ordinals.length - 1] ?? ''
	return ordinals.length <= 1
		? last
		: `${ordinals.slice(0, -1).join(', ')} ${t('training.form.and')} ${last}`
}

/**
 * mockups/training-form.html: an exercise of the template with «Як за планом» (on while nothing
 * differs), «Повернути» for a skipped one, and — when opened — its sets to correct. Any edit turns
 * «Як за планом» off and says what changed; pressing it brings the plan back.
 */
export const ExercisePlanRow = ({ exercise, onChange, onRemove }: ExercisePlanRowProps) => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [selected, setSelected] = useState<number | null>(null)
	const setsRef = useRef<HTMLDivElement>(null)
	const removeSet = useFormSetRemoval(exercise, onChange)
	const rememberFocus = useSwipeFocus(
		setsRef,
		() => setsRef.current?.querySelector<HTMLElement>('[data-add-set]') ?? null,
		SWIPE_ROWS_ANYWHERE,
	)
	const deleteSet = (index: number, position: number): void => {
		rememberFocus(position)
		setSelected((current) =>
			current === null || current < index ? current : current === index ? null : current - 1,
		)
		removeSet(index)
	}
	// a new set grows in, a removed one slides out and lets the rest glide up
	const enteringSets = useEnteringKeys(exercise.sets.map((set) => set.rowKey))
	const state = getExerciseState(exercise)
	const isSkipped = state === 'SKIPPED'
	const isBodyweight = isFormBodyweight(exercise)
	const summary = formatPlanSummary(exercise, t)
	const subtitle =
		state === 'ADDED'
			? [summary, t('training.form.addedMark')]
					.filter((part): part is string => part !== null)
					.join(DETAIL_SEPARATOR)
			: summary
	const changed = getChangedSetNumbers(exercise)
	const group = exercise.kind === 'CARDIO' ? 'CARDIO' : exercise.muscleGroup
	const isCardio = exercise.kind === 'CARDIO'
	const isAdded = state === 'ADDED'
	const skip = (): void => {
		onChange({ ...exercise, isSkipped: true })
		setIsOpen(false)
	}
	const isRowChanged = (index: number): boolean =>
		changed.includes(index + 1) && exercise.plan !== null

	const body = (
		<div
			className={cn(
				'flex flex-col gap-2 rounded-tile bg-surface/85 p-3',
				state === 'CHANGED' && 'bg-muscle-arms-bg',
			)}
		>
			<div className="flex min-h-11 items-center gap-2.5">
				<GroupDot group={group} />
				<button
					type="button"
					aria-expanded={isOpen}
					disabled={isSkipped}
					onClick={() => {
						setIsOpen((current) => !current)
					}}
					className="flex min-h-tap min-w-0 flex-1 cursor-pointer flex-col justify-center text-left disabled:cursor-default"
				>
					<Text as="span" variant="cardTitle" className="truncate">
						{exercise.name}
					</Text>
					<Text as="span" variant="small" tone="mutedStrong" weight="regular">
						{isSkipped ? t('training.form.skipped') : subtitle}
					</Text>
				</button>
				{isSkipped ? (
					<Button
						size="sm"
						variant="secondary"
						className="min-h-tap"
						onClick={() => {
							onChange(restorePlan(exercise))
						}}
					>
						{t('training.form.restore')}
					</Button>
				) : (
					state !== 'ADDED' && (
						<motion.button
							type="button"
							aria-pressed={state === 'PLANNED'}
							onClick={() => {
								onChange(restorePlan(exercise))
							}}
							{...PRESS}
							className={cn(
								'flex min-h-11 flex-none cursor-pointer items-center gap-1 rounded-full px-3 text-caption font-bold',
								state === 'PLANNED' ? 'bg-success-soft text-success-ink' : 'bg-secondary text-ink',
							)}
						>
							{state === 'PLANNED' && <Icon name="check" size={ICON_SIZE.small} />}
							{t('training.form.asPlanned')}
						</motion.button>
					)
				)}
			</div>
			{state === 'CHANGED' && exercise.plan !== null && !isCardio && (
				<Text as="span" variant="small" tone="mutedStrong" weight="regular">
					{t('training.form.changed', {
						sets: t('training.form.changedSets', {
							count: changed.length,
							list: formatChangedSets(changed, t),
						}),
						plan: summary,
					})}
				</Text>
			)}
			{isOpen && !isSkipped && isCardio && (
				<SetStepper
					value={exercise.durationMin}
					valueText={formatSetReps(exercise.durationMin)}
					unit={t('training.live.unitMin')}
					placeholder={t('training.live.minutesPlaceholder')}
					min={MIN_MINUTES}
					max={PROGRAM_DURATION_MIN_MAX}
					decimals={0}
					decreaseLabel={t('training.live.minutesLess')}
					increaseLabel={t('training.live.minutesMore')}
					editLabel={t('training.live.minutesEdit')}
					isDecreaseDisabled={(exercise.durationMin ?? 0) <= MIN_MINUTES}
					onDecrease={() => {
						onChange({
							...exercise,
							durationMin: Math.max(MIN_MINUTES, (exercise.durationMin ?? 0) - 1),
						})
					}}
					onIncrease={() => {
						onChange({ ...exercise, durationMin: (exercise.durationMin ?? 0) + 1 })
					}}
					onCommit={(durationMin) => {
						onChange({ ...exercise, durationMin })
					}}
				/>
			)}
			{isOpen && !isSkipped && !isCardio && (
				<div ref={setsRef} className="flex flex-col gap-2">
					<SwipeGroup>
						<SetTable hasWeight={!isBodyweight}>
							<AnimatePresence>
								{exercise.sets.map((set, index) => {
									const deleteLabel = set.isWarmup
										? t('workout.deleteWarmupAria')
										: t('workout.deleteSetAria', { n: index + 1 })
									const content =
										index === selected ? (
											<SetFields
												title={t('training.live.setTitle', { n: index + 1 })}
												reps={set.reps}
												weightKg={set.weightKg}
												isBodyweight={isBodyweight}
												weightStepKg={DEFAULT_PROGRESS_STEP_KG}
												onChange={(patch) => {
													onChange(patchFormSet(exercise, index, patch))
												}}
												deleteLabel={deleteLabel}
												onDelete={() => {
													// only one set is a block, so every set above it is a row
													deleteSet(index, index)
												}}
											/>
										) : (
											<SwipeToDelete
												actionLabel={t('workout.swipeDelete')}
												actionAriaLabel={deleteLabel}
												onAction={(row) => {
													const position =
														setsRef.current && row
															? countSwipeRowsBefore(setsRef.current, row, SWIPE_ROWS_ANYWHERE)
															: 0
													deleteSet(index, position)
												}}
											>
												<SetRow
													label={String(index + 1)}
													ariaLabel={t('training.live.setEdit', { n: index + 1 })}
													reps={set.reps}
													weightKg={set.weightKg}
													hasWeight={!isBodyweight}
													isChanged={isRowChanged(index)}
													isWarmup={set.isWarmup}
													isDone={false}
													onSelect={() => {
														setSelected(index)
													}}
													trailing={
														isRowChanged(index) ? (
															<Text
																as="span"
																variant="small"
																tone="mutedStrong"
																className="pr-2 text-muscle-arms-ink"
															>
																{t('training.form.setChanged')}
															</Text>
														) : null
													}
												/>
											</SwipeToDelete>
										)
									return (
										<RowMotion key={set.rowKey} isEntering={enteringSets.has(set.rowKey)}>
											{content}
										</RowMotion>
									)
								})}
							</AnimatePresence>
						</SetTable>
					</SwipeGroup>
					<div className={cn('gap-2', isAdded ? 'flex' : 'grid grid-cols-2')}>
						<Button
							variant="secondary"
							className="flex-1"
							data-add-set=""
							disabled={exercise.sets.length >= MAX_SETS_PER_EXERCISE}
							onClick={() => {
								onChange(addFormSet(exercise))
							}}
						>
							{t('training.live.addSet')}
						</Button>
						{isAdded ? (
							<IconButton
								label={t('workout.deleteExerciseAria', { name: exercise.name })}
								variant="ghost"
								className="text-muted-strong"
								onClick={(event) => {
									onRemove(event.currentTarget.closest<HTMLElement>('[data-swipe-row]'))
								}}
							>
								<Icon name="trash" size={ICON_SIZE.control} />
							</IconButton>
						) : (
							<Button variant="secondary" onClick={skip}>
								{t('training.form.skip')}
							</Button>
						)}
					</div>
				</div>
			)}
		</div>
	)

	if (isSkipped) return body

	return (
		<SwipeToDelete
			variant={isAdded ? 'danger' : 'neutral'}
			actionLabel={isAdded ? t('workout.swipeDelete') : t('training.form.skip')}
			actionAriaLabel={
				isAdded
					? t('workout.deleteExerciseAria', { name: exercise.name })
					: t('training.form.skipAria', { name: exercise.name })
			}
			onAction={isAdded ? onRemove : skip}
		>
			{body}
		</SwipeToDelete>
	)
}
