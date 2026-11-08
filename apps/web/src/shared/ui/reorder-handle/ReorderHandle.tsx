import { type KeyboardEvent, useEffect, useRef } from 'react'

import { cn } from '@/shared/lib'

import { Icon, ICON_SIZE } from '../icon'
import type { ReorderHandleProps } from './reorder-handle.types'

/** The ≡ handle: a drag starts here (when `onPointerDown` is given), or ↑ / ↓ on the focused handle. */
export const ReorderHandle = ({ label, index, onMove, onPointerDown }: ReorderHandleProps) => {
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
		// an ignored move at an edge changes no index: the flag must not wait for a later one
		isRefocusPending.current = onMove(event.key === 'ArrowUp' ? -1 : 1)
	}

	return (
		<button
			ref={handleRef}
			type="button"
			aria-label={label}
			aria-keyshortcuts="ArrowUp ArrowDown"
			onPointerDown={onPointerDown}
			onKeyDown={handleKeyDown}
			className={cn(
				'-ml-2.5 flex size-11 flex-none items-center justify-center rounded-full text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ink',
				onPointerDown && 'cursor-grab touch-none active:cursor-grabbing',
			)}
		>
			<Icon name="menu" size={ICON_SIZE.control} />
		</button>
	)
}
