import { cva, type VariantProps } from 'class-variance-authority'

export const textareaVariants = cva(
	'block w-full min-w-0 resize-none overflow-y-auto bg-transparent p-0 text-ink outline-none placeholder:truncate placeholder:text-muted focus-visible:outline-none',
	{
		variants: {
			variant: {
				/**
				 * chat composer, grows up to 132px (mockups/chat-long-input.html). 16px, not the mockup's
				 * 15: iOS zooms into any field under 16px on focus (CLAUDE-design rule 4)
				 */
				composer: 'max-h-33 text-input font-medium',
				/** inside a FormField card: 16/600 like Input */
				field: 'max-h-40 text-input font-semibold',
			},
		},
		defaultVariants: { variant: 'composer' },
	},
)

export type TextareaVariantProps = VariantProps<typeof textareaVariants>
