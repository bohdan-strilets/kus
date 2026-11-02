import { cva, type VariantProps } from 'class-variance-authority'

/**
 * The 6px dot of a day (mockups/week-strip.html): success in the norm, over above it, a ring for a
 * plan, nothing without a record. On the chosen ink pill it is white (a white ring for a plan).
 */
export const foodDayDotVariants = cva('size-1.5 rounded-full', {
	variants: {
		status: {
			normal: '',
			over: '',
			empty: 'bg-transparent',
			planned: 'border',
		},
		isSelected: { true: '', false: '' },
	},
	compoundVariants: [
		{ status: 'normal', isSelected: false, className: 'bg-success' },
		{ status: 'over', isSelected: false, className: 'bg-over' },
		{ status: 'planned', isSelected: false, className: 'border-success' },
		{ status: ['normal', 'over'], isSelected: true, className: 'bg-white' },
		{ status: 'planned', isSelected: true, className: 'border-white' },
	],
})

export type FoodDayDotVariantProps = VariantProps<typeof foodDayDotVariants>
