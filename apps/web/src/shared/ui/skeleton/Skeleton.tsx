import { cn } from '@/shared/lib'

import { type SkeletonVariantProps, skeletonVariants } from './skeleton.variants'

export type SkeletonProps = SkeletonVariantProps & {
	/** Size and layout come from the caller so the skeleton repeats the real content's shape. */
	className?: string
}

/**
 * A placeholder that repeats the shape of content still loading (CLAUDE.md §12). Decorative:
 * the container announces loading (role="status" + aria-label).
 */
export const Skeleton = ({ shape, className }: SkeletonProps) => (
	<span aria-hidden="true" className={cn(skeletonVariants({ shape }), className)} />
)
