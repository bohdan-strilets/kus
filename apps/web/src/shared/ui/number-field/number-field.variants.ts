import { cva, type VariantProps } from 'class-variance-authority'

export const numberFieldCardVariants = cva(
	'flex flex-col gap-1 focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset',
	{
		variants: {
			size: {
				lg: 'rounded-chip bg-primary-selected px-4 py-3',
				sm: 'rounded-tile px-3 py-2.5',
			},
		},
		defaultVariants: { size: 'lg' },
	},
)

export const numberFieldInputVariants = cva(
	'field-sizing-content w-auto max-w-full min-w-4 bg-transparent p-0 tabular-nums outline-none',
	{
		variants: {
			size: {
				lg: 'text-field-number text-ink',
				sm: 'text-field-number-sm text-ink',
			},
		},
		defaultVariants: { size: 'lg' },
	},
)

export const numberFieldUnitVariants = cva('', {
	variants: {
		size: {
			lg: 'text-stat text-muted',
			sm: 'text-caption text-current',
		},
	},
	defaultVariants: { size: 'lg' },
})

export type NumberFieldSize = NonNullable<VariantProps<typeof numberFieldCardVariants>['size']>
