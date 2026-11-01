import { cva, type VariantProps } from 'class-variance-authority'

/** The border a selected chip gets: the ink of its group, as in the add-exercise mockup. */
export const groupChipBorderVariants = cva('', {
	variants: {
		group: {
			CARDIO: 'border-muscle-cardio-ink',
			CHEST: 'border-muscle-chest-ink',
			BACK: 'border-muscle-back-ink',
			LEGS: 'border-muscle-legs-ink',
			SHOULDERS: 'border-muscle-shoulders-ink',
			ARMS: 'border-muscle-arms-ink',
			CORE: 'border-muscle-core-ink',
		},
	},
})

export type GroupChipBorderVariantProps = VariantProps<typeof groupChipBorderVariants>
