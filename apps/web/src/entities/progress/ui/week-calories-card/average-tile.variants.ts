import { cva, type VariantProps } from 'class-variance-authority'

/** «Середнє» (the carbs-coloured tile of the mockup) and «Білок, середнє» (the protein tile). */
export const averageTileVariants = cva('flex flex-col rounded-tile px-3 py-2.5', {
	variants: {
		tone: {
			kcal: 'bg-carbs-bg',
			protein: 'bg-protein-bg',
		},
	},
})

export const averageTileLabelVariants = cva('text-small font-semibold', {
	variants: {
		tone: {
			kcal: 'text-carbs-ink',
			protein: 'text-protein-ink',
		},
	},
})

export type AverageTileVariantProps = VariantProps<typeof averageTileVariants>
