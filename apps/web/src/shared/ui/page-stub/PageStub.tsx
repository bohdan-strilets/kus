import type { ReactNode } from 'react'

interface PageStubProps {
	title: string
	description: string
	children?: ReactNode
}

/** Temporary page body for screens that aren't built yet; replaced as each screen lands. */
export const PageStub = ({ title, description, children }: PageStubProps) => (
	<section className="flex flex-col gap-4 px-4 pt-6">
		<h1 className="text-2xl font-extrabold">{title}</h1>
		<p className="text-muted">{description}</p>
		{children}
	</section>
)
