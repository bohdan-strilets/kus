import type { ReactNode } from 'react'

import { Surface, Text } from '@/shared/ui'

interface StatsPanelProps {
	title: string
	/** Right of the title: a hint or a summary line. */
	aside?: ReactNode
	children: ReactNode
}

/** A white card of the stats screen: a bold title with a small note beside it, then the content. */
export const StatsPanel = ({ title, aside, children }: StatsPanelProps) => (
	<Surface variant="list" radius="bubbleAi" className="flex flex-col gap-3 p-4">
		<div className="flex items-baseline justify-between gap-2">
			<Text as="span" variant="cardTitle" weight="extrabold">
				{title}
			</Text>
			{aside && (
				<Text as="span" variant="small" tone="muted" className="text-right">
					{aside}
				</Text>
			)}
		</div>
		{children}
	</Surface>
)
