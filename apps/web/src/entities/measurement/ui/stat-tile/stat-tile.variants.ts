import { cva, type VariantProps } from 'class-variance-authority'

/** «Від старту» (success) and «До цілі» (the warm tile of chat-weight) on the weight card. */
export const statTileVariants = cva('flex flex-col rounded-tile-sm px-3 py-2.5', {
	variants: {
		tone: {
			success: 'bg-success-soft',
			goal: 'bg-fat-bg',
		},
	},
	defaultVariants: { tone: 'success' },
})

export const statTileLabelVariants = cva('text-small font-semibold', {
	variants: {
		tone: {
			success: 'text-success-ink',
			goal: 'text-fat-ink',
		},
	},
	defaultVariants: { tone: 'success' },
})

export type StatTileVariantProps = VariantProps<typeof statTileVariants>
