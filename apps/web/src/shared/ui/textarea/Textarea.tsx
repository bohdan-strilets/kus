import { type ComponentPropsWithRef, type InputEvent, useCallback, useRef } from 'react'

import { cn, useAutoHeight } from '@/shared/lib'

import { type TextareaVariantProps, textareaVariants } from './textarea.variants'

export type TextareaProps = TextareaVariantProps & ComponentPropsWithRef<'textarea'>

/** Starts at one line and grows with its text up to the variant's max height, then scrolls. */
export const Textarea = ({
	variant,
	rows = 1,
	value,
	onInput,
	ref: externalRef,
	className,
	...props
}: TextareaProps) => {
	const ref = useRef<HTMLTextAreaElement>(null)
	const resize = useAutoHeight(ref, value)

	// keeps our measuring ref and the caller's ref (e.g. React Hook Form focus) on the same node;
	// stable between renders so a callback ref isn't re-called with null on every render
	const setRefs = useCallback(
		(node: HTMLTextAreaElement | null): void => {
			ref.current = node
			if (typeof externalRef === 'function') externalRef(node)
			else if (externalRef) externalRef.current = node
		},
		[externalRef],
	)

	const handleInput = (event: InputEvent<HTMLTextAreaElement>): void => {
		resize()
		onInput?.(event)
	}

	return (
		<textarea
			ref={setRefs}
			rows={rows}
			value={value}
			onInput={handleInput}
			className={cn(textareaVariants({ variant }), className)}
			{...props}
		/>
	)
}
