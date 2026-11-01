import { useTranslation } from 'react-i18next'

import { formatProgramTarget, getExerciseGroup } from '@/entities/program'
import { GroupDot } from '@/entities/workout'
import { Text } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'

interface ExerciseSummaryProps {
	exercise: Pick<DraftExercise, 'name' | 'kind' | 'muscleGroup' | 'target'>
}

/** A dot of the group, the name and the plan with its details: «3 × 10–12 · 120 кг · +5 кг · 120 с». */
export const ExerciseSummary = ({ exercise }: ExerciseSummaryProps) => {
	const { t } = useTranslation()
	const group = getExerciseGroup(exercise)
	const target = formatProgramTarget(exercise, t, { withDetails: true })
	return (
		<>
			{group !== null && <GroupDot group={group} />}
			<span className="flex min-w-0 flex-1 flex-col text-left">
				<Text as="span" variant="body" weight="bold">
					{exercise.name}
				</Text>
				{target !== null && (
					<Text as="span" variant="small" tone="mutedStrong" isTabular>
						{target}
					</Text>
				)}
			</span>
		</>
	)
}
