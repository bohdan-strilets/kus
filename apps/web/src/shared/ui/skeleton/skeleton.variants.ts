import { cva, type VariantProps } from 'class-variance-authority'

export const skeletonVariants = cva('block animate-pulse bg-track motion-reduce:animate-none', {
	variants: {
		shape: {
			line: 'h-3 rounded-full',
			block: 'rounded-tile',
			circle: 'rounded-full',
		},
	},
	defaultVariants: { shape: 'line' },
})

export type SkeletonVariantProps = VariantProps<typeof skeletonVariants>
