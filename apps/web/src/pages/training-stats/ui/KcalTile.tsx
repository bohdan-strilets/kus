import type { WorkoutStatsResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { KcalInfoSheet } from '@/entities/workout'
import { formatInteger } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton, Surface, Text } from '@/shared/ui'

interface KcalTileProps {
	burned: NonNullable<WorkoutStatsResponse['overview']['burned']>
	period: WorkoutStatsResponse['period']
}

/**
 * mockups/training-stats.html «Спалено на тренуваннях за місяць»: the named kcal as they are plus the
 * estimate of the rest. An estimate gets «≈» and «оцінка»; everything named — the plain number.
 * Always «на ціль не впливає»; the `info` opens the same sheet as the session.
 */
export const KcalTile = ({ burned, period }: KcalTileProps) => {
	const { t } = useTranslation()
	const [isInfoOpen, setIsInfoOpen] = useState(false)
	const kcal = formatInteger(burned.kcal)

	return (
		<>
			<Surface radius="tile" className="flex flex-none items-center gap-2.5 px-3 py-2.5">
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<Text as="span" variant="small" tone="mutedStrong">
						{t('training.stats.overview.kcalTile.title', {
							period: t(`training.stats.period.short.${period}`),
						})}
					</Text>
					<Text as="span" variant="stat">
						{t(burned.isEstimate ? 'workout.kcal.estimateValue' : 'workout.kcal.value', { kcal })}
					</Text>
					<Text as="span" variant="small" tone="muted">
						{t(
							burned.isEstimate
								? 'training.stats.overview.kcalTile.estimateCaption'
								: 'training.stats.overview.kcalTile.namedCaption',
						)}
					</Text>
				</span>
				<IconButton
					label={t('workout.kcal.infoAria')}
					onClick={() => {
						setIsInfoOpen(true)
					}}
				>
					<Icon name="info" size={ICON_SIZE.control} />
				</IconButton>
			</Surface>
			<KcalInfoSheet isOpen={isInfoOpen} onOpenChange={setIsInfoOpen} />
		</>
	)
}
