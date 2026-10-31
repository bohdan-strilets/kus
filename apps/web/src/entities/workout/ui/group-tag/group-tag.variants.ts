import { cva, type VariantProps } from 'class-variance-authority'

/** «Спина 6», «Кардіо 25 хв»: padding 3 9, radius 9, 700, the pair of the group (training-groups). */
export const groupTagVariants = cva(
	'inline-flex flex-none items-center gap-1 rounded-tag px-2.25 py-0.75 font-bold whitespace-nowrap',
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
			},
			size: {
				sm: 'text-small',
				md: 'text-caption',
			},
		},
		defaultVariants: { size: 'md' },
	},
)

export type GroupTagVariantProps = VariantProps<typeof groupTagVariants>
