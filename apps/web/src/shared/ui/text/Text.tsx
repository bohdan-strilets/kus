import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/shared/lib'

import { type TextVariantProps, textVariants } from './text.variants'

type TextElement = 'p' | 'span' | 'div' | 'label' | 'strong'

export type TextProps = TextVariantProps &
	ComponentPropsWithoutRef<'span'> & {
		as?: TextElement
		/** Equal-width digits for numbers that change (kcal, grams). */
		isTabular?: boolean
		htmlFor?: string
	}

export const Text = ({
	as = 'p',
	variant,
	tone,
	weight,
	isTabular = false,
	className,
	...props
}: TextProps) => {
	// a narrow union of intrinsic text elements
	const Component: ElementType = as
	return (
		<Component
			className={cn(
				textVariants({ variant, tone, weight }),
				isTabular && 'tabular-nums',
				className,
			)}
			{...props}
		/>
	)
}
