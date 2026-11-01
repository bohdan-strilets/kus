import type { ExerciseDictionaryItem } from '@kus/shared'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { getExerciseGroup } from '@/entities/program'
import { formatLastSets, GroupDot, SetLine } from '@/entities/workout'
import { PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

interface ExerciseResultRowProps {
	exercise: ExerciseDictionaryItem
	onAdd: () => void
}

/** A row of «Мої вправи»: the group dot, the name, the last result in the notation of sets, and «+». */
export const ExerciseResultRow = ({ exercise, onAdd }: ExerciseResultRowProps) => {
	const { t } = useTranslation()
	const group = getExerciseGroup(exercise)
	const lastSets = formatLastSets(exercise.lastSets, t)

	return (
		<motion.button
			type="button"
			aria-label={t('program.editor.add', { name: exercise.name })}
			onClick={onAdd}
			{...PRESS}
			className="flex min-h-13 w-full cursor-pointer items-center gap-2.5 border-t border-divider text-left first:border-t-0"
		>
			{group !== null && <GroupDot group={group} />}
			<span className="flex min-w-0 flex-1 flex-col">
				<Text as="span" variant="body" weight="bold">
					{exercise.name}
				</Text>
				{exercise.lastSets === null && (
					<Text as="span" variant="small" tone="muted" weight="regular">
						{t('program.editor.neverDone')}
					</Text>
				)}
				{lastSets !== null && <SetLine sets={lastSets} />}
			</span>
			<Icon name="plus" size={ICON_SIZE.control} className="flex-none text-ink" />
		</motion.button>
	)
}
