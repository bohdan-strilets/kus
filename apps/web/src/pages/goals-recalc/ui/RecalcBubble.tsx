import type { ReactNode } from 'react'

import { MessageBubble } from '@/entities/message'

/** Kusik's bubble that holds a card edge to edge instead of the usual padding. */
export const RecalcBubble = ({ children }: { children: ReactNode }) => (
	<MessageBubble className="gap-0 overflow-hidden p-0">{children}</MessageBubble>
)
