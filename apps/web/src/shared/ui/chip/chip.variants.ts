import { cva, type VariantProps } from 'class-variance-authority'

/**
 * quick — chips above the composer (chat: 36, frosted, shadow-chip, 13/600);
 * select — multi-select in onboarding «Чого не їси» (38, field; selected: 2px primary border,
 * primary-selected, 13/700 and a check — mockups/onboarding-4-food.html).
 * Both keep a ≥ 44px tap area through an invisible ::after (CLAUDE.md §13).
 */
export const chipVariants = cva(
	'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-caption text-ink select-none after:absolute after:inset-x-0 disabled:cursor-not-allowed disabled:opacity-50',
	{
		variants: {
			variant: {
				quick: 'min-h-9 bg-surface/85 px-3.5 shadow-chip after:-inset-y-1',
				select:
					'min-h-9.5 border-2 px-3 transition-colors duration-(--duration-base) after:-inset-y-0.75',
			},
			isSelected: {
				true: '',
				false: '',
			},
		},
		compoundVariants: [
			{
				variant: 'select',
				isSelected: true,
				className: 'border-primary bg-primary-selected font-bold',
			},
			{ variant: 'select', isSelected: false, className: 'border-transparent bg-field' },
		],
		defaultVariants: { variant: 'quick', isSelected: false },
	},
)

export type ChipVariantProps = VariantProps<typeof chipVariants>
