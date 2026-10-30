import { cva } from 'class-variance-authority'

/** Segments of «Продукти | Про тебе»: the mockup's 40px raised to the 44px tap minimum (CLAUDE.md §13); the active one is ink. */
export const memoryTabVariants = cva(
	'flex min-h-tap items-center justify-center rounded-icon text-card-title transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
	{
		variants: {
			isActive: {
				true: 'bg-ink font-bold text-white',
				false: 'bg-transparent font-semibold text-muted-strong',
			},
		},
	},
)
