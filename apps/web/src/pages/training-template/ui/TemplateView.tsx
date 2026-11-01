import { useTranslation } from 'react-i18next'

import { Surface, Text } from '@/shared/ui'

import type { DraftExercise } from '../lib/template-draft.types'
import { ExerciseSummary } from './ExerciseSummary'

interface TemplateViewProps {
	exercises: readonly DraftExercise[]
}

/** mockups/training-program.html «Шаблон»: the exercises in order with their plan, and what the line means. */
export const TemplateView = ({ exercises }: TemplateViewProps) => {
	const { t } = useTranslation()
	return (
		<>
			<Surface variant="glass" radius="bubbleAi" shadow="list" className="px-3.5 py-1">
				<ul className="flex flex-col">
					{exercises.map((exercise) => (
						<li
							key={exercise.key}
							className="flex min-h-13 items-center gap-2.5 border-t border-divider first:border-t-0"
						>
							<ExerciseSummary exercise={exercise} />
						</li>
					))}
				</ul>
			</Surface>
			<Text variant="small" tone="muted" weight="regular" className="px-1">
				{t('program.template.legend')}
			</Text>
		</>
	)
}
