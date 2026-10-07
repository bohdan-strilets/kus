import { cva } from 'class-variance-authority'

/** 14px, radius 12; the mockups' 42px height raised to the 44px tap minimum (CLAUDE.md §13). */
export const authTabVariants = cva(
	'flex min-h-tap items-center justify-center rounded-icon text-card-title transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
	{
		variants: {
			isActive: {
				true: 'bg-surface font-bold text-ink shadow-chip',
				false: 'bg-transparent font-semibold text-muted-strong',
			},
		},
	},
)
