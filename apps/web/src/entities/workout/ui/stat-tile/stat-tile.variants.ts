import { cva, type VariantProps } from 'class-variance-authority'

export const statTileVariants = cva('flex min-w-0 flex-1 flex-col gap-0.5 rounded-tile px-3 py-3', {
	variants: {
		tone: {
			solid: 'bg-surface shadow-card',
			cardio: 'bg-muscle-cardio-bg text-muscle-cardio-ink',
		},
	},
	defaultVariants: { tone: 'solid' },
})

export type StatTileVariantProps = VariantProps<typeof statTileVariants>
