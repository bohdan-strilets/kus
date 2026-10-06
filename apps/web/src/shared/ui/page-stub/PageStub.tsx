import type { ReactNode } from 'react'

import { Heading } from '../heading'
import { Text } from '../text'

interface PageStubProps {
	title: string
	description: string
	children?: ReactNode
}

/** Temporary page body for screens that aren't built yet; replaced as each screen lands. */
export const PageStub = ({ title, description, children }: PageStubProps) => (
	<section className="flex flex-col gap-4 px-gutter pt-6">
		<Heading as="h1">{title}</Heading>
		<Text tone="muted">{description}</Text>
		{children}
	</section>
)
