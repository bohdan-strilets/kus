import { WORKOUT_STATS_PERIODS, type WorkoutStatsPeriod } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { SegmentedToggle } from '@/shared/ui'

interface PeriodToggleProps {
	value: WorkoutStatsPeriod
	onChange: (period: WorkoutStatsPeriod) => void
}

/** «Тиждень · Місяць · 3 місяці», shared by all three tabs. */
export const PeriodToggle = ({ value, onChange }: PeriodToggleProps) => {
	const { t } = useTranslation()

	return (
		<SegmentedToggle
			size="wide"
			aria-label={t('training.stats.period.aria')}
			value={value}
			onChange={onChange}
			options={WORKOUT_STATS_PERIODS.map((period) => ({
				value: period,
				label: t(`training.stats.period.${period}`),
			}))}
		/>
	)
}
