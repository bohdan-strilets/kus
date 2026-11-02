import type { WorkoutResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatWorkoutDuration } from '@/entities/workout'
import { DeleteWorkoutButton } from '@/features/delete-workout'
import { ROUTES } from '@/shared/config'
import { useStackBack } from '@/shared/lib'
import { ScreenHeader } from '@/shared/ui'

import { formatSessionHeader } from '../lib/format-session-header'
import { getSessionView } from '../lib/session-view'
import { SessionKcalLine } from './SessionKcalLine'
import { SessionSection } from './SessionSection'
import { SessionTiles } from './SessionTiles'

/** The loaded screen: header, numbers, a card per group, «Видалити тренування». */
export const SessionContent = ({ workout }: { workout: WorkoutResponse }) => {
	const { t } = useTranslation()
	const goBack = useStackBack(ROUTES.training)
	const header = formatSessionHeader(workout, t)
	const view = getSessionView(workout)

	return (
		<>
			<ScreenHeader
				title={header.title}
				subtitle={header.subtitle}
				extra={<SessionKcalLine workout={workout} />}
				backTo={ROUTES.training}
			/>
			<div className="flex flex-col gap-2.5 pb-4">
				<SessionTiles
					duration={formatWorkoutDuration(workout, t)}
					strength={view.strength}
					cardio={view.cardio}
				/>
				<div className="flex flex-col gap-2.5 px-gutter">
					{view.sections.map((section) => (
						<SessionSection key={section.key} section={section} />
					))}
					<div className="flex justify-center">
						<DeleteWorkoutButton workout={workout} onDeleted={goBack} />
					</div>
				</div>
			</div>
		</>
	)
}
