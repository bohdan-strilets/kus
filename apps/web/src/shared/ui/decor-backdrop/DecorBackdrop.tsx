import { cn } from '@/shared/lib'

import { DecorCrumb } from './DecorCrumb'
import { DECOR_BLOBS, DECOR_CRUMBS, DECOR_DOTS, DECOR_RINGS } from './decor-backdrop.constants'

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
			<DecorCrumb key={className} className={className} />
		))}
		{DECOR_RINGS.map((className) => (
			<span key={className} className={cn('absolute rounded-full border-2', className)} />
		))}
		{DECOR_DOTS.map((className) => (
			<span key={className} className={cn('absolute rounded-full', className)} />
		))}
	</div>
)
