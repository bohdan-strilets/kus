import type { ComponentPropsWithRef } from 'react'

import { cn } from '@/shared/lib'

export type StickyActionsProps = ComponentPropsWithRef<'div'>

/**
 * The action buttons at the end of a scrolling sheet body: pinned to its bottom edge, so with the
 * keyboard open «Зберегти» stays above it instead of scrolling away. Spans the body's side padding.
 */
export const StickyActions = ({ className, ...props }: StickyActionsProps) => (
	<div
		className={cn(
			'sticky bottom-0 -mx-4 flex flex-col gap-3.5 bg-surface px-4 pt-2 pb-2',
			className,
		)}
		{...props}
	/>
)
