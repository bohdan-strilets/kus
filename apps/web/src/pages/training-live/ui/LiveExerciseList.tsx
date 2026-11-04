import { AnimatePresence } from 'motion/react'

import type { LiveDraft, LiveSession } from '@/features/live-workout'
import { useEnteringKeys } from '@/shared/lib'
import { RowMotion, SwapFade, SwipeGroup } from '@/shared/ui'

import { LiveCardio } from './LiveCardio'
import { LiveExercise } from './LiveExercise'
import { LiveExerciseRow } from './LiveExerciseRow'

interface LiveExerciseListProps {
	draft: LiveDraft
	session: LiveSession
	/** The exercise in hand; -1 when none is. */
	focusIndex: number
	/** The first exercise after the current one that is not done: «далі · …». */
	nextIndex: number
	onDeleteExercise: (index: number, origin: Element | null) => void
}

/**
 * The exercises of the session: the one in hand is a card, the others are rows. A row that goes
 * or comes slides and grows (design/docs/motion.md «Живий режим» п. 4), and when the hand moves on,
 * the card folds into a row and the next row unfolds (п. 3) — the same slot, its content fades.
 */
export const LiveExerciseList = ({
	draft,
	session,
	focusIndex,
	nextIndex,
	onDeleteExercise,
}: LiveExerciseListProps) => {
	const enteringKeys = useEnteringKeys(draft.exercises.map((exercise) => exercise.rowKey))

	return (
		<SwipeGroup>
			<AnimatePresence>
				{draft.exercises.map((exercise, index) => {
					const isFocused = index === focusIndex
					const content = isFocused ? (
						exercise.kind === 'CARDIO' ? (
							<LiveCardio
								exercise={exercise}
								exerciseIndex={index}
								session={session}
								onDeleteExercise={(origin) => {
									onDeleteExercise(index, origin)
								}}
							/>
						) : (
							<LiveExercise
								exercise={exercise}
								exerciseIndex={index}
								session={session}
								onDeleteExercise={(origin) => {
									onDeleteExercise(index, origin)
								}}
							/>
						)
					) : (
						<LiveExerciseRow
							exercise={exercise}
							isNext={index === nextIndex}
							onSelect={
								exercise.readOnly
									? null
									: () => {
											session.selectExercise(index)
										}
							}
							onDelete={
								exercise.readOnly
									? null
									: (row) => {
											onDeleteExercise(index, row)
										}
							}
						/>
					)

					return (
						<RowMotion
							key={exercise.rowKey}
							isEntering={enteringKeys.has(exercise.rowKey)}
							glide="slow"
						>
							<SwapFade contentKey={isFocused ? 'card' : 'row'}>{content}</SwapFade>
						</RowMotion>
					)
				})}
			</AnimatePresence>
		</SwipeGroup>
	)
}
