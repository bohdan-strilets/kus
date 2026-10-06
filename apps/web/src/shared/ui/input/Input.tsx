import type { ComponentPropsWithRef } from 'react'

import { cn } from '@/shared/lib'

export type InputProps = ComponentPropsWithRef<'input'>

/**
 * The bare control inside a FormField card: 16/600 so iOS doesn't zoom (CLAUDE-design rule 4).
 * Focus is shown by the card's inset ring, not by the input itself.
 */
export const Input = ({ className, ...props }: InputProps) => (
	<input
		className={cn(
			'min-h-6 w-full min-w-0 bg-transparent p-0 text-input font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted focus-visible:outline-none',
			className,
		)}
		{...props}
	/>
)
