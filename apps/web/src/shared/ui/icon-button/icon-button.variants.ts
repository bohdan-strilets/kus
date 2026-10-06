import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Round icon buttons from the mockups: back (44, frosted), sheet close (44, secondary),
 * composer camera / mic (42, secondary), send and «+» (44, primary).
 * The 42px size keeps a ≥ 44px tap area through an invisible ::after (CLAUDE.md §13).
 */
export const iconButtonVariants = cva(
	'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50',
	{
		variants: {
			variant: {
				primary: 'bg-primary text-white',
				secondary: 'bg-secondary text-muted-strong',
				frosted: 'bg-surface/85 text-ink shadow-chip',
				dangerSoft: 'bg-danger-soft text-danger',
				ghost: 'bg-transparent text-ink',
			},
			size: {
				md: 'size-11',
				sm: 'size-10.5 after:absolute after:-inset-0.5',
			},
		},
		defaultVariants: { variant: 'secondary', size: 'md' },
	},
)

export type IconButtonVariantProps = VariantProps<typeof iconButtonVariants>
