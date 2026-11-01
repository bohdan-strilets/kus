import type { TrainingGroupKey } from '@kus/shared'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn, PRESS } from '@/shared/lib'

import { groupTagVariants } from '../group-tag'
import { groupChipBorderVariants } from './group-chip.variants'

export interface GroupChipProps {
	group: TrainingGroupKey
	isSelected: boolean
	onClick: () => void
}

/** A filter chip in the colours of the group: 44 tall, a 2px border of the group's ink when selected. */
export const GroupChip = ({ group, isSelected, onClick }: GroupChipProps) => {
	const { t } = useTranslation()
	return (
		<motion.button
			type="button"
			aria-pressed={isSelected}
			onClick={onClick}
			{...PRESS}
			className={cn(
				groupTagVariants({ group }),
				'min-h-11 cursor-pointer justify-center rounded-full border-2 px-3.5 text-card-title select-none',
				isSelected ? groupChipBorderVariants({ group }) : 'border-transparent',
			)}
		>
			{t(`muscle.${group}`)}
		</motion.button>
	)
}
