import { PROGRAM_EXERCISES_PER_TEMPLATE_MAX } from '@kus/shared'
import { Reorder } from 'motion/react'
import { type Dispatch, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Surface, Text } from '@/shared/ui'

import type { TemplateDraftAction } from '../lib/template-draft.reducer'
import type { DraftExercise } from '../lib/template-draft.types'
import { AddExerciseSheet } from './AddExerciseSheet'
import { DashedAction } from './DashedAction'
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
	// what a screen reader hears after a keyboard move; a drag by a finger needs no words
	const [announcement, setAnnouncement] = useState('')
	const targetExercise = exercises.find((exercise) => exercise.key === targetKey) ?? null

	const move = (exercise: DraftExercise, index: number, delta: -1 | 1): void => {
		const position = index + delta
		if (position < 0 || position >= exercises.length) return
		dispatch({ type: 'move', key: exercise.key, delta })
		setAnnouncement(
			t('program.editor.position', {
				name: exercise.name,
				position: position + 1,
				total: exercises.length,
			}),
		)
	}

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
							onMove={(delta) => {
								move(exercise, index, delta)
							}}
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
				onSave={(key, target) => {
					dispatch({ type: 'setTarget', key, target })
					setTargetKey(null)
				}}
				onRemove={(key) => {
					dispatch({ type: 'remove', key })
					setTargetKey(null)
				}}
			/>
			<AddExerciseSheet
				isOpen={isAddOpen}
				onOpenChange={setIsAddOpen}
				onAdd={(exercise) => {
					dispatch({ type: 'add', exercise })
					setIsAddOpen(false)
				}}
			/>
		</>
	)
}
