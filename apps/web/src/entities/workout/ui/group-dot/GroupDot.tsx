import type { TrainingGroupKey } from '@kus/shared'

import { cn } from '@/shared/lib'

import { groupDotVariants } from './group-dot.variants'

export interface GroupDotProps {
	group: TrainingGroupKey
	size?: 'sm' | 'md'
	className?: string
}

/** Decorative: the group names live in the aria-label of the parent; a colour is never the only carrier. */
export const GroupDot = ({ group, size, className }: GroupDotProps) => (
	<span aria-hidden="true" className={cn(groupDotVariants({ group, size }), className)} />
)
