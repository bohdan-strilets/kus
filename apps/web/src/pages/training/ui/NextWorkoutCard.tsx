import type { ProgramTemplateResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatProgramTemplateMeta, getExerciseGroup } from '@/entities/program'
import { DETAIL_SEPARATOR, GroupDot } from '@/entities/workout'
import { getTrainingTemplatePath } from '@/shared/config'
import { Hamster, Text } from '@/shared/ui'

const HAMSTER_SIZE = 96

/** mockups/training-home.html «Наступне» (0.10.2): the template, its exercises with group dots, the hamster. */
export const NextWorkoutCard = ({ template }: { template: ProgramTemplateResponse }) => {
	const { t } = useTranslation()

	return (
		<section
			aria-label={t('training.next.label')}
			className="relative flex flex-none flex-col gap-1.5 overflow-hidden rounded-card bg-linear-160 from-hint-training-bg to-surface to-70% p-3.5 shadow-card"
		>
			<Text as="span" variant="eyebrow" className="text-hint-training-ink">
				{t('training.next.label')}
			</Text>
			<Link
				to={getTrainingTemplatePath(template.id)}
				className="max-w-60 text-title font-extrabold text-ink after:absolute after:inset-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
			>
				{`${template.name}${DETAIL_SEPARATOR}${formatProgramTemplateMeta(template, t)}`}
			</Link>
			<ul className="flex max-w-57 flex-col gap-1 pt-0.5 pb-1">
				{template.exercises.map((exercise) => {
					const group = getExerciseGroup(exercise)
					return (
						<li key={exercise.id} className="flex items-center gap-2">
							{group !== null && <GroupDot group={group} size="sm" />}
							<Text as="span" variant="cardTitle" weight="regular" className="min-w-0 truncate">
								{exercise.name}
							</Text>
						</li>
					)
				})}
			</ul>
			<span className="absolute top-10 -right-1.5">
				<Hamster mood="dumbbell" size={HAMSTER_SIZE} />
			</span>
		</section>
	)
}
