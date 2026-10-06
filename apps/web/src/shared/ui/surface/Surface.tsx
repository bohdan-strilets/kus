import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@/shared/lib'

import { type SurfaceVariantProps, surfaceVariants } from './surface.variants'

type SurfaceElement = 'div' | 'section' | 'article' | 'aside'

export type SurfaceProps = SurfaceVariantProps &
	ComponentPropsWithoutRef<'div'> & {
		as?: SurfaceElement
		children?: ReactNode
	}

/** The base card: colour, radius and shadow only — spacing and layout stay with the caller. */
export const Surface = ({
	as = 'div',
	variant,
	radius,
	shadow,
	className,
	...props
}: SurfaceProps) => {
	// a narrow union of intrinsic elements that all accept div props
	const Component: ElementType = as
	return (
		<Component className={cn(surfaceVariants({ variant, radius, shadow }), className)} {...props} />
	)
}
