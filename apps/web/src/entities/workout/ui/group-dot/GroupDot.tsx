import type { TrainingGroupKey } from '@kus/shared'

import { cn } from '@/shared/lib'

import { groupDotVariants } from './group-dot.variants'

export interface GroupDotProps {
	/** Null is «Інше»: an exercise without a muscle group, a neutral grey dot. */
	group: TrainingGroupKey | null
	size?: 'xs' | 'sm' | 'md'
	/** `onDark` — the light colour of the group, for a dot on an ink pill. */
	tone?: 'ink' | 'onDark'
	className?: string
}

/** Decorative: the group names live in the aria-label of the parent; a colour is never the only carrier. */
export const GroupDot = ({ group, size, tone, className }: GroupDotProps) => (
	<span
		aria-hidden="true"
		className={cn(groupDotVariants({ group: group ?? 'OTHER', size, tone }), className)}
	/>
)
