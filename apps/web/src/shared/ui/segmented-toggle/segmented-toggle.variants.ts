import { cva } from 'class-variance-authority'

export const segmentedToggleVariants = cva('flex bg-surface/75', {
	variants: {
		size: {
			compact: 'rounded-chip p-1',
			wide: 'gap-1 rounded-bubble-ai p-0.5',
			tall: 'gap-0.5 rounded-card p-0.5',
		},
	},
	defaultVariants: { size: 'compact' },
})

/**
 * The visible pill is 34px (compact), 40px (wide) or a real 44px (tall, program mode); an invisible ::after stretches the tap area
 * to 44px (CLAUDE.md §13), and to 44px wide for a short label.
 */
export const segmentedToggleItemVariants = cva(
	'relative cursor-pointer transition-colors after:absolute after:left-1/2 after:w-full after:min-w-tap after:-translate-x-1/2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
	{
		variants: {
			size: {
				compact: 'min-h-8.5 rounded-tile-sm px-3 text-caption after:-inset-y-1.25',
				wide: 'min-h-10 flex-1 rounded-bubble text-card-title after:-inset-y-0.5',
				// a real 44px box (no ::after needed) and one line even at 375px
				tall: 'min-h-tap flex-1 rounded-full px-1.5 text-caption whitespace-nowrap',
			},
			isSelected: {
				true: 'bg-ink font-bold text-white',
				false: 'font-semibold text-muted-strong',
			},
		},
		defaultVariants: { size: 'compact', isSelected: false },
	},
)
