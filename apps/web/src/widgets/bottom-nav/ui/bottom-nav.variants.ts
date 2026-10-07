import { cva, type VariantProps } from 'class-variance-authority'

/** The floating bar: radius 30, white 94 %, shadow-float (mockups/chat.html). */
export const navBarVariants = cva('rounded-nav bg-surface/94 p-1.5 shadow-float')

/** One tab: label 12/800 primary when active, 12/600 muted otherwise. */
export const navTabVariants = cva(
	'flex min-h-14 flex-col items-center justify-center gap-0.75 rounded-chip text-small transition-colors duration-(--duration-base)',
	{
		variants: {
			isActive: {
				true: 'font-extrabold text-primary',
				false: 'font-semibold text-muted',
			},
		},
		defaultVariants: { isActive: false },
	},
)

export type NavTabVariantProps = VariantProps<typeof navTabVariants>
