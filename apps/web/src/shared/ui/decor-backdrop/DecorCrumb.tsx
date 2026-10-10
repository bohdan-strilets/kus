import { cn, useSvgId } from '@/shared/lib'

const BITES = [
	{ cx: 91, cy: 31, r: 10 },
	{ cx: 83, cy: 18, r: 10 },
	{ cx: 70, cy: 10, r: 9.5 },
] as const

export interface DecorCrumbProps {
	/** Position, size, colour (`text-*`) and rotation; the crumb itself is `absolute`. */
	className: string
}

/** The brand crumb: a round cookie with three bites out of its top-right edge. Decorative. */
export const DecorCrumb = ({ className }: DecorCrumbProps) => {
	const maskId = useSvgId('decor-bite')
	return (
		<svg viewBox="0 0 100 100" aria-hidden="true" className={cn('absolute', className)}>
			<defs>
				<mask id={maskId}>
					<rect width="100" height="100" fill="white" />
					{BITES.map((bite) => (
						<circle key={bite.cx} {...bite} fill="black" />
					))}
				</mask>
			</defs>
			<circle cx="50" cy="50" r="42" fill="currentColor" mask={`url(#${maskId})`} />
		</svg>
	)
}
