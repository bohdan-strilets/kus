import { cva, type VariantProps } from 'class-variance-authority'

/**
 * docs Bubble + mockups/chat.html: the user's bubble is primary with the tail bottom-right; Kusik's
 * is white glass with the tail bottom-left (radius 22 in the mockups) and sits next to the head.
 */
export const messageBubbleVariants = cva('text-body', {
	variants: {
		author: {
			user: 'max-w-4/5 rounded-bubble rounded-br-tail bg-primary px-3.75 py-2.75 text-white shadow-accent',
			kusik:
				'flex flex-col gap-2.5 rounded-bubble-ai rounded-bl-tail bg-surface-glass p-3 text-ink shadow-card',
		},
		tone: {
			default: '',
			/** chat-error: Kusik's «ой» reply on a warm tint */
			error: 'bg-primary-selected',
		},
	},
	defaultVariants: { author: 'kusik', tone: 'default' },
})

export type MessageBubbleVariantProps = VariantProps<typeof messageBubbleVariants>
