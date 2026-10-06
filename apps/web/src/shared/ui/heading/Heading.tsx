import type { ComponentPropsWithRef } from 'react'

import { cn } from '@/shared/lib'

import { type HeadingVariantProps, headingVariants } from './heading.variants'

type HeadingElement = 'h1' | 'h2' | 'h3'

export type HeadingProps = HeadingVariantProps &
	ComponentPropsWithRef<'h2'> & {
		as?: HeadingElement
	}

export const Heading = ({ as: Component = 'h2', level, className, ...props }: HeadingProps) => (
	<Component className={cn(headingVariants({ level }), className)} {...props} />
)
