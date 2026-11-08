import { Reorder, useDragControls } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, ReorderHandle } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'
import { ExerciseSummary } from './ExerciseSummary'

const DRAG_TILT_DEG = -1

interface EditorExerciseRowProps {
	exercise: DraftExercise
	/** Where the row stands now; a change brings the focus back to the handle after a keyboard move. */
	index: number
	onOpen: () => void
	onRemove: () => void
	/** False when the move is not possible (the first row up, the last down). */
	onMove: (delta: -1 | 1) => boolean
}

/**
 * A row of the editor: the ≡ handle (the only place a drag starts, or ↑ / ↓ on the focused handle),
 * the exercise (a tap opens its target) and the 44px «×».
 */
export const EditorExerciseRow = ({
	exercise,
	index,
	onOpen,
	onRemove,
	onMove,
}: EditorExerciseRowProps) => {
	const { t } = useTranslation()
	const dragControls = useDragControls()
	const [isDragging, setIsDragging] = useState(false)
	return (
		<Reorder.Item
			as="li"
			value={exercise.key}
			dragListener={false}
			dragControls={dragControls}
			whileDrag={{ rotate: DRAG_TILT_DEG }}
			onDragStart={() => {
				setIsDragging(true)
			}}
			onDragEnd={() => {
				setIsDragging(false)
			}}
			className={cn(
				'flex min-h-13 items-center gap-2.5 border-t border-divider first:border-t-0',
				isDragging &&
					'relative z-10 -mx-2.5 rounded-tile-sm border-transparent bg-surface px-2.5 shadow-float',
			)}
		>
			<ReorderHandle
				label={t('program.editor.drag', { name: exercise.name })}
				index={index}
				onMove={onMove}
				onPointerDown={(event) => {
					dragControls.start(event)
				}}
			/>
			<button
				type="button"
				onClick={onOpen}
				className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink"
			>
				<ExerciseSummary exercise={exercise} />
				<Icon name="chevron-right" size={ICON_SIZE.control} className="flex-none text-muted" />
			</button>
			<IconButton
				label={t('program.editor.remove', { name: exercise.name })}
				variant="ghost"
				className="-mr-2"
				onClick={onRemove}
			>
				<Icon name="close" size={ICON_SIZE.control} />
			</IconButton>
		</Reorder.Item>
	)
}
