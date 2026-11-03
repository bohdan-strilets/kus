import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { GroupTag } from '@/entities/workout'
import { Surface, Text } from '@/shared/ui'

import { formatSectionSummary } from '../lib/format-section-summary'
import type { SessionSection as SessionSectionData } from '../lib/session-view'
import { SessionExercise } from './SessionExercise'

export interface SessionSectionProps {
	section: SessionSectionData
	workoutKcal?: WorkoutResponse['kcal']
}

/** A card of one group (training-session): the tag with a summary on the right, the exercises below. */
export const SessionSection = ({ section, workoutKcal }: SessionSectionProps) => {
	const { t } = useTranslation()
	const summary = formatSectionSummary(section, t)

	return (
		<Surface radius="bubbleAi" className="flex flex-col px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				{section.group !== null && <GroupTag group={section.group} />}
				{summary !== null && (
					<Text as="span" variant="small" tone="muted" className="ml-auto" isTabular>
						{summary}
					</Text>
				)}
			</div>
			<ul className="flex flex-col">
				{section.exercises.map((exercise) => (
					<SessionExercise key={exercise.id} exercise={exercise} workoutKcal={workoutKcal} />
				))}
			</ul>
		</Surface>
	)
}
