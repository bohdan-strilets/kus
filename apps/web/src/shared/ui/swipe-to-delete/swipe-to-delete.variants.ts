import { cva } from 'class-variance-authority'

/** The clipping frame of the row: the action lives behind it and shows as the row moves away. */
export const swipeFrameVariants = cva('relative touch-pan-y overflow-hidden', {
	variants: {
		radius: { tile: 'rounded-tile', chip: 'rounded-chip' },
	},
	defaultVariants: { radius: 'tile' },
})

export const swipeActionVariants = cva('absolute inset-0 flex justify-end', {
	variants: {
		variant: {
			danger: 'bg-danger text-white',
			neutral: 'bg-handle text-ink',
		},
	},
	defaultVariants: { variant: 'danger' },
})
