import type { ReactNode } from 'react'

import { Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 140

interface MemoryEmptyProps {
	title: string
	text: string
	/** The button after the text (products); facts have none. */
	action?: ReactNode
}

/** mockups/memory-products.html «Порожньо» and memory-facts.html: the hamster, what will appear here, one way forward. */
export const MemoryEmpty = ({ title, text, action }: MemoryEmptyProps) => (
	<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-5 text-center">
		<Hamster mood="hungry" size={HAMSTER_SIZE} />
		<Heading as="h2" level="title">
			{title}
		</Heading>
		<Text tone="mutedStrong">{text}</Text>
		{action}
	</div>
)
