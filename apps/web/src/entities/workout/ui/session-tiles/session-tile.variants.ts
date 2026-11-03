import { cva, type VariantProps } from 'class-variance-authority'

/** A tile of the numbers row (training-session): white, the cardio one on its group's colour. */
export const sessionTileVariants = cva(
	'flex min-w-0 flex-auto flex-col gap-0.5 rounded-tile px-2.5 py-3',
	{
		variants: {
			tone: {
				solid: 'bg-surface shadow-card',
				cardio: 'bg-muscle-cardio-bg text-muscle-cardio-ink',
			},
		},
		defaultVariants: { tone: 'solid' },
	},
)

export type SessionTileVariantProps = VariantProps<typeof sessionTileVariants>
