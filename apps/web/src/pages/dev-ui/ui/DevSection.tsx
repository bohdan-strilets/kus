import type { ReactNode } from 'react'

interface DevSectionProps {
	title: string
	hint?: string
	children: ReactNode
}

export const DevSection = ({ title, hint, children }: DevSectionProps) => (
	<section className="flex flex-col gap-3">
		<h2 className="text-small font-bold tracking-wider text-muted uppercase">{title}</h2>
		{hint && <p className="text-caption text-muted">{hint}</p>}
		{children}
	</section>
)
