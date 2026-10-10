import type { ReactNode } from 'react'

import { Text } from '@/shared/ui'

interface MyDataSectionProps {
	title: string
	children: ReactNode
}

/** An eyebrow over a card of rows. */
export const MyDataSection = ({ title, children }: MyDataSectionProps) => (
	<section className="flex flex-col gap-2">
		<Text variant="eyebrow" tone="muted" className="px-1">
			{title}
		</Text>
		{children}
	</section>
)
