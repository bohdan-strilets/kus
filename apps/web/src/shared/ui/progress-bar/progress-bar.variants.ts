import { cva, type VariantProps } from 'class-variance-authority'

/** Track: white 80% inside a macro tile (today), `track` on a plain card (docs MacroBar). */
export const progressTrackVariants = cva('h-1.25 overflow-hidden rounded-full', {
	variants: {
		track: {
			white: 'bg-white/80',
			track: 'bg-track',
		},
	},
	defaultVariants: { track: 'track' },
})

/** Fill colours: macros always protein → carbs → fat; success for goals. */
export const progressFillVariants = cva('h-full rounded-full', {
	variants: {
		tone: {
			protein: 'bg-protein-bar',
			carbs: 'bg-carbs-bar',
			fat: 'bg-fat-bar',
			success: 'bg-success',
		},
	},
	defaultVariants: { tone: 'success' },
})

export type ProgressTrackVariantProps = VariantProps<typeof progressTrackVariants>
export type ProgressFillVariantProps = VariantProps<typeof progressFillVariants>
