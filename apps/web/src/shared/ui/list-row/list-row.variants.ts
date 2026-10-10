import { cva, type VariantProps } from 'class-variance-authority'

/** A row inside RowGroup: 52 in my-data / settings, 56 in the profile menu. */
export const listRowVariants = cva('flex items-center gap-3 px-3.5 text-left', {
	variants: {
		size: {
			md: 'min-h-13',
			lg: 'min-h-14',
		},
		isInteractive: {
			true: 'w-full cursor-pointer focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ink',
			false: '',
		},
	},
	defaultVariants: { size: 'md', isInteractive: false },
})

export type ListRowVariantProps = VariantProps<typeof listRowVariants>

/** The 34px icon tile at the start of a profile menu row. */
export const listRowIconVariants = cva(
	'flex size-8.5 shrink-0 items-center justify-center rounded-icon',
	{
		variants: {
			tone: {
				protein: 'bg-protein-bg text-protein-bar',
				fat: 'bg-fat-bg text-fat-bar',
			},
		},
		defaultVariants: { tone: 'protein' },
	},
)

export type ListRowIconVariantProps = VariantProps<typeof listRowIconVariants>
