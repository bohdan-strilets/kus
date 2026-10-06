import { cva, type VariantProps } from 'class-variance-authority'

export const badgeVariants = cva('inline-flex shrink-0 items-center', {
	variants: {
		variant: {
			/** «370 ккал» on a meal card: primary-soft / primary-deep, 13/800, radius 10 (chat) */
			kcal: 'rounded-badge bg-primary-soft px-2.5 py-1 text-caption font-extrabold text-primary-deep tabular-nums',
			/** «new» dot on a nav tab: 9px notice with a 2px white ring (every tab mockup) */
			notice: 'size-2.25 rounded-full bg-notice ring-2 ring-white',
			/** «logged» check: 30px success circle (interactive/motion.html size, docs colour) */
			success: 'size-7.5 justify-center rounded-full bg-success text-white',
			/** «Не надіслано» under a failed message: 12/600 danger with an icon (chat-error) */
			failed: 'gap-1 text-small text-danger',
		},
	},
	defaultVariants: { variant: 'kcal' },
})

export type BadgeVariantProps = VariantProps<typeof badgeVariants>
