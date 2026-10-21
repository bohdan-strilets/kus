import { cva, type VariantProps } from 'class-variance-authority'

/** A figure tile of the stats card: the macro palette for the numbers, a plain field for counts. */
export const statsTileVariants = cva('flex min-w-0 flex-col rounded-tile-sm px-3 py-2.5', {
	variants: {
		tone: {
			kcal: 'bg-success-soft text-success-ink',
			protein: 'bg-protein-bg text-protein-ink',
			norm: 'bg-carbs-bg text-carbs-ink',
			weight: 'bg-fat-bg text-fat-ink',
			plain: 'bg-field text-muted',
		},
	},
	defaultVariants: { tone: 'plain' },
})

export type StatsTileVariantProps = VariantProps<typeof statsTileVariants>
