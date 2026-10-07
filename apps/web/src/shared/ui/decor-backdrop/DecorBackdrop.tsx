import { cn, useSvgId } from '@/shared/lib'

import { DECOR_BLOBS, DECOR_CRUMBS, DECOR_DOTS, DECOR_RINGS } from './decor-backdrop.constants'

const BITES = [
	{ cx: 91, cy: 31, r: 10 },
	{ cx: 83, cy: 18, r: 10 },
	{ cx: 70, cy: 10, r: 9.5 },
] as const

const Crumb = ({ className }: { className: string }) => {
	const maskId = useSvgId('decor-bite')
	return (
		<svg viewBox="0 0 100 100" className={cn('absolute', className)}>
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

/**
 * docs/motion.md «Декоративні фони»: soft blurred circles and static crumbs behind auth (later
 * splash and empty states). The parent needs `isolate`; decor never takes pointer events.
 * Fixed and aligned with the 480px app column, but not clipped to it: on wide screens the blobs
 * fade out past the column instead of ending in a hard edge, and fixed boxes never add scroll.
 */
export const DecorBackdrop = () => (
	<div
		aria-hidden="true"
		className="pointer-events-none fixed inset-y-0 left-1/2 -z-10 w-full max-w-app -translate-x-1/2"
	>
		{DECOR_BLOBS.map((className) => (
			<span key={className} className={cn('absolute rounded-full blur-xl', className)} />
		))}
		{DECOR_CRUMBS.map((className) => (
			<Crumb key={className} className={className} />
		))}
		{DECOR_RINGS.map((className) => (
			<span key={className} className={cn('absolute rounded-full border-2', className)} />
		))}
		{DECOR_DOTS.map((className) => (
			<span key={className} className={cn('absolute rounded-full', className)} />
		))}
	</div>
)
