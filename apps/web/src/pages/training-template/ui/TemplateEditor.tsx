import { PROGRAM_EXERCISES_PER_TEMPLATE_MAX } from '@kus/shared'
import { Reorder } from 'motion/react'
import { type Dispatch, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useReorderAnnouncement } from '@/shared/lib'
import { DashedAction, Surface, Text } from '@/shared/ui'

import { createDraftExercise } from '../lib/new-exercise'
import type { TemplateDraftAction } from '../lib/template-draft.reducer'
import type { DraftExercise } from '../lib/template-draft.types'
import { ExercisePickerSheet } from '@/entities/workout'
import { EditorExerciseRow } from './EditorExerciseRow'
import { ExerciseTargetSheet } from './ExerciseTargetSheet'

interface TemplateEditorProps {
	exercises: readonly DraftExercise[]
	dispatch: Dispatch<TemplateDraftAction>
}

/**
 * mockups/training-program.html «Редактор»: reorder by ≡ (drag, or ↑ / ↓ on the focused handle), tap
 * for the target, × to remove, «+ Вправа». Nothing is sent until «Готово»; the state is the page's.
 */
export const TemplateEditor = ({ exercises, dispatch }: TemplateEditorProps) => {
	const { t } = useTranslation()
	const [targetKey, setTargetKey] = useState<string | null>(null)
	const [isAddOpen, setIsAddOpen] = useState(false)
	const targetExercise = exercises.find((exercise) => exercise.key === targetKey) ?? null

	const { move, announcement } = useReorderAnnouncement({
		items: exercises,
		getName: (exercise) => exercise.name,
		onMove: (index, delta) => {
			const exercise = exercises[index]
			if (exercise) dispatch({ type: 'move', key: exercise.key, delta })
		},
	})

	return (
		<>
			<Surface variant="glass" radius="bubbleAi" shadow="list" className="px-3.5 py-1">
				<Reorder.Group
					as="ul"
					axis="y"
					values={exercises.map((exercise) => exercise.key)}
					onReorder={(keys: string[]) => {
						dispatch({ type: 'reorder', keys })
					}}
					className="flex flex-col"
				>
					{exercises.map((exercise, index) => (
						<EditorExerciseRow
							key={exercise.key}
							exercise={exercise}
							index={index}
							onOpen={() => {
								setTargetKey(exercise.key)
							}}
							onRemove={() => {
								dispatch({ type: 'remove', key: exercise.key })
							}}
							onMove={(delta) => move(index, delta)}
						/>
					))}
				</Reorder.Group>
			</Surface>
			<p role="status" aria-live="polite" className="sr-only">
				{announcement}
			</p>
			<DashedAction
				isDisabled={exercises.length >= PROGRAM_EXERCISES_PER_TEMPLATE_MAX}
				onClick={() => {
					setIsAddOpen(true)
				}}
			>
				{t('program.editor.addExercise')}
			</DashedAction>
			<Text variant="small" tone="muted" weight="regular" className="px-1">
				{t('program.editor.hint')}
			</Text>
			<ExerciseTargetSheet
				exercise={targetExercise}
				onClose={() => {
					setTargetKey(null)
				}}
				onSave={(key, target, isBodyweight) => {
					dispatch({ type: 'setTarget', key, target, isBodyweight })
					setTargetKey(null)
				}}
				onRemove={(key) => {
					dispatch({ type: 'remove', key })
					setTargetKey(null)
				}}
			/>
			<ExercisePickerSheet
				isOpen={isAddOpen}
				onOpenChange={setIsAddOpen}
				onPick={(pick) => {
					dispatch({ type: 'add', exercise: createDraftExercise(pick) })
					setIsAddOpen(false)
				}}
			/>
		</>
	)
}
