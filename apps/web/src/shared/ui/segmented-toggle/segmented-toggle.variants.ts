import { cva } from 'class-variance-authority'

export const segmentedToggleVariants = cva('flex bg-surface/75', {
	variants: {
		size: {
			compact: 'rounded-chip p-1',
			wide: 'gap-1 rounded-bubble-ai p-0.5',
		},
	},
	defaultVariants: { size: 'compact' },
})

/**
 * The visible pill is 34px (compact) or 40px (wide); an invisible ::after stretches the tap area
 * to 44px (CLAUDE.md §13), and to 44px wide for a short label.
 */
export const segmentedToggleItemVariants = cva(
	'relative cursor-pointer transition-colors after:absolute after:left-1/2 after:w-full after:min-w-tap after:-translate-x-1/2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
	{
		variants: {
			size: {
				compact: 'min-h-8.5 rounded-tile-sm px-3 text-caption after:-inset-y-1.25',
				wide: 'min-h-10 flex-1 rounded-bubble text-card-title after:-inset-y-0.5',
			},
			isSelected: {
				true: 'bg-ink font-bold text-white',
				false: 'font-semibold text-muted-strong',
			},
		},
		defaultVariants: { size: 'compact', isSelected: false },
	},
)
