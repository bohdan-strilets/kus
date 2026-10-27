import { cva, type VariantProps } from 'class-variance-authority'

/** The width of a stats bar: 18 px a day or a wide week, 14 px a week among many, 12 / 6 px a day. */
export const statsBarVariants = cva('overflow-hidden rounded-badge', {
	variants: {
		width: {
			wide: 'w-4.5',
			medium: 'w-3',
			narrow: 'w-1.5',
		},
	},
	defaultVariants: { width: 'wide' },
})

export type StatsBarVariantProps = VariantProps<typeof statsBarVariants>
