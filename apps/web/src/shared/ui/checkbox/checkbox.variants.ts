import { cva } from 'class-variance-authority'

/** 22px box: white with a border when off, solid primary with a white check when on. */
export const checkboxVariants = cva(
	'mt-px ml-px flex size-5.5 shrink-0 items-center justify-center rounded-checkbox border-2 text-white transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
	{
		variants: {
			isChecked: {
				true: 'border-primary bg-primary',
				false: 'border-muted-soft bg-surface',
			},
		},
	},
)
