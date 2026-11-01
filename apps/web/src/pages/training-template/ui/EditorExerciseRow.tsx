import { Reorder, useDragControls } from 'motion/react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'
import { ExerciseSummary } from './ExerciseSummary'

const DRAG_TILT_DEG = -1

interface EditorExerciseRowProps {
	exercise: DraftExercise
	/** Where the row stands now; a change brings the focus back to the handle after a keyboard move. */
	index: number
	onOpen: () => void
	onRemove: () => void
	onMove: (delta: -1 | 1) => void
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
	const handleRef = useRef<HTMLButtonElement>(null)
	const isRefocusPending = useRef(false)

	// a move re-orders the DOM, which can drop the focus: put it back on the handle that moved
	useEffect(() => {
		if (!isRefocusPending.current) return
		isRefocusPending.current = false
		handleRef.current?.focus()
	}, [index])

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
		event.preventDefault()
		isRefocusPending.current = true
		onMove(event.key === 'ArrowUp' ? -1 : 1)
	}

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
			<button
				ref={handleRef}
				type="button"
				aria-label={t('program.editor.drag', { name: exercise.name })}
				onPointerDown={(event) => {
					dragControls.start(event)
				}}
				onKeyDown={handleKeyDown}
				className="-ml-2.5 flex size-11 flex-none cursor-grab touch-none items-center justify-center rounded-full text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink active:cursor-grabbing"
			>
				<Icon name="menu" size={ICON_SIZE.control} />
			</button>
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
