import { cva, type VariantProps } from 'class-variance-authority'

/** The 36 px tile of an exercise on the tint of its group (chat-training); OTHER — a group unknown. */
export const groupIconVariants = cva(
	'flex size-9 flex-none items-center justify-center rounded-icon',
	{
		variants: {
			group: {
				CARDIO: 'bg-muscle-cardio-bg text-muscle-cardio-ink',
				CHEST: 'bg-muscle-chest-bg text-muscle-chest-ink',
				BACK: 'bg-muscle-back-bg text-muscle-back-ink',
				LEGS: 'bg-muscle-legs-bg text-muscle-legs-ink',
				SHOULDERS: 'bg-muscle-shoulders-bg text-muscle-shoulders-ink',
				ARMS: 'bg-muscle-arms-bg text-muscle-arms-ink',
				CORE: 'bg-muscle-core-bg text-muscle-core-ink',
				OTHER: 'bg-hint-training-bg text-hint-training-ink',
			},
		},
		defaultVariants: { group: 'OTHER' },
	},
)

export type GroupIconVariantProps = VariantProps<typeof groupIconVariants>
