import type { TrainingGroupKey } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'

import { groupTagVariants } from './group-tag.variants'

export interface GroupTagProps {
	group: TrainingGroupKey
	size?: 'sm' | 'md'
	/** Already formatted: «6» for sets, «25 хв» for cardio. */
	detail?: string
	className?: string
}

/** The plate of a muscle group, optionally with a number: «Спина 6». */
export const GroupTag = ({ group, size, detail, className }: GroupTagProps) => {
	const { t } = useTranslation()
	return (
		<span className={cn(groupTagVariants({ group, size }), className)}>
			{t(`muscle.${group}`)}
			{detail !== undefined && <span className="tabular-nums">{detail}</span>}
		</span>
	)
}
