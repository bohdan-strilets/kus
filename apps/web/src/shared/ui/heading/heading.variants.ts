import { cva, type VariantProps } from 'class-variance-authority'

export const headingVariants = cva('text-balance text-ink', {
	variants: {
		level: {
			/** screen header, 24/800 */
			screen: 'text-screen-title',
			/** sheet, dialog and empty state titles, 20/800 */
			title: 'text-title',
		},
	},
	defaultVariants: { level: 'screen' },
})

export type HeadingVariantProps = VariantProps<typeof headingVariants>
