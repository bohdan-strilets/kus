import { cva, type VariantProps } from 'class-variance-authority'

/**
 * docs Bubble + mockups/chat.html: the user's bubble is a light primary tint (variant A of
 * chat-user-bubble-options) with the tail bottom-right; Kusik's is white glass with the tail
 * bottom-left (radius 22 in the mockups) and sits next to the head.
 */
export const messageBubbleVariants = cva('text-body', {
	variants: {
		author: {
			user: 'max-w-4/5 rounded-bubble rounded-br-tail bg-primary-soft px-3.75 py-2.75 text-ink',
			kusik:
				'flex flex-col gap-2.5 rounded-bubble-ai rounded-bl-tail bg-surface-glass p-3 text-ink shadow-card',
		},
	},
	defaultVariants: { author: 'kusik' },
})

export type MessageBubbleVariantProps = VariantProps<typeof messageBubbleVariants>
