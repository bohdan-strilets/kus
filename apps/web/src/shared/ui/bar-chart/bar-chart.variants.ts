import { cva } from 'class-variance-authority'

/** Data colours (CLAUDE.md §3): training = hint-training-ink, cardio = muscle-cardio-ink, success. */
export const barVariants = cva('w-full max-w-5.5 shrink-0 rounded-checkbox', {
	variants: {
		tone: {
			training: 'bg-hint-training-ink',
			cardio: 'bg-muscle-cardio-ink',
			success: 'bg-success',
		},
	},
	defaultVariants: { tone: 'training' },
})
