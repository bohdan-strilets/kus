import type { WorkoutResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatWorkoutKcal, KcalInfoSheet, KcalNote } from '@/entities/workout'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

/**
 * Under the date in the header (mockups/training-session.html): «≈ 350 ккал · оцінка» or the named
 * number with its source, and an `info` that opens «Ккал на тренуванні». No number — no line.
 */
export const SessionKcalLine = ({ workout }: { workout: Pick<WorkoutResponse, 'kcal'> }) => {
	const { t } = useTranslation()
	const [isInfoOpen, setIsInfoOpen] = useState(false)
	const view = formatWorkoutKcal(workout.kcal, t)
	if (view === null) return null

	return (
		<>
			<button
				type="button"
				aria-label={`${view.note}. ${t('workout.kcal.infoAria')}`}
				onClick={() => {
					setIsInfoOpen(true)
				}}
				className="relative inline-flex min-h-8 cursor-pointer items-center gap-1 self-start after:absolute after:inset-x-0 after:-inset-y-1.5"
			>
				<Text as="span" variant="caption" weight="regular" tone="mutedStrong">
					<KcalNote view={view} />
				</Text>
				<Icon name="info" size={ICON_SIZE.small} className="flex-none text-muted" />
			</button>
			<KcalInfoSheet isOpen={isInfoOpen} onOpenChange={setIsInfoOpen} />
		</>
	)
}
