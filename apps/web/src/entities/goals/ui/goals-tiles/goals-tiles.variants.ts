import { cva, type VariantProps } from 'class-variance-authority'

/** profile «Цілі на день»: a tile per goal, in the colour of its macro (kcal is primary-soft). */
export const goalTileVariants = cva('flex flex-col rounded-tile p-3', {
	variants: {
		tone: {
			kcal: 'bg-primary-soft',
			protein: 'bg-protein-bg',
			carbs: 'bg-carbs-bg',
			fat: 'bg-fat-bg',
		},
	},
})

export const GOAL_TILE_LABEL_INK = {
	kcal: 'text-primary-deep',
	protein: 'text-protein-ink',
	carbs: 'text-carbs-ink',
	fat: 'text-fat-ink',
} as const

export type GoalTileTone = NonNullable<VariantProps<typeof goalTileVariants>['tone']>
