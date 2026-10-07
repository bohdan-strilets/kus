import type { ReactNode } from 'react'

import { HamsterHead } from '@/shared/ui'

import { getKusikFace, type KusikReplyKind } from '../../lib/get-kusik-face'

export interface KusikRowProps {
	/** What the reply is about; picks the avatar face. */
	kind?: KusikReplyKind
	/** The bubble or card (MessageBubble, EntryCard, …). */
	children: ReactNode
}

/** A Kusik reply in the feed: the 34px head at the bottom left, the content next to it. */
export const KusikRow = ({ kind = 'reply', children }: KusikRowProps) => (
	<div className="flex items-end gap-2 self-stretch pr-4">
		<HamsterHead mood={getKusikFace(kind)} />
		<div className="flex min-w-0 flex-1 flex-col">{children}</div>
	</div>
)
