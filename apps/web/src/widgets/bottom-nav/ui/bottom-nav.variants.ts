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
			// five tabs: 66 px columns, so the label is tighter and never wraps (nav-5-tabs)
			isCompact: {
				true: 'min-w-0 tracking-nav whitespace-nowrap',
				false: '',
			},
		},
		defaultVariants: { isActive: false, isCompact: false },
	},
)

export type NavTabVariantProps = VariantProps<typeof navTabVariants>

/** The raised «Чат» tab of the five-tab bar: 30 px over the bar, label 12/800 primary when active. */
export const chatTabVariants = cva(
	'-mt-7.5 flex min-h-14 flex-col items-center justify-end gap-0.75 pb-1 text-small transition-colors duration-(--duration-base)',
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

/** The 56 circle with a 4 px ring in the bar's colour (nav-5-tabs). */
export const chatCircleVariants = cva(
	'relative flex size-14 items-center justify-center overflow-hidden rounded-full ring-4 ring-surface',
	{
		variants: {
			isActive: {
				true: 'bg-primary text-white shadow-nav-chat',
				false: 'bg-primary-soft text-primary shadow-nav-chat-idle',
			},
		},
		defaultVariants: { isActive: false },
	},
)
