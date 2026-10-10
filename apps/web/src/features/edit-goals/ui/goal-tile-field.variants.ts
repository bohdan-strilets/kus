import { cva, type VariantProps } from 'class-variance-authority'

/** goals-edit-sheet: a tile per goal in the colour of its macro (kcal is primary-soft). */
export const goalTileFieldVariants = cva(
	'flex flex-col gap-1 rounded-tile px-3 py-2.5 ring-inset focus-within:ring-2 focus-within:ring-primary',
	{
		variants: {
			tone: {
				kcal: 'bg-primary-soft text-primary-deep',
				protein: 'bg-protein-bg text-protein-ink',
				carbs: 'bg-carbs-bg text-carbs-ink',
				fat: 'bg-fat-bg text-fat-ink',
			},
			hasError: {
				true: 'ring-2 ring-danger',
				false: '',
			},
		},
		defaultVariants: { hasError: false },
	},
)

export type GoalTileTone = NonNullable<VariantProps<typeof goalTileFieldVariants>['tone']>
