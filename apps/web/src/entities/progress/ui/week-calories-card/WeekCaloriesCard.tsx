import type { ProgressWeek } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Surface, Text } from '@/shared/ui'

import { AverageTile } from './AverageTile'
import { WeekBarsChart } from './WeekBarsChart'

export interface WeekCaloriesCardProps {
	week: ProgressWeek
	/** `YYYY-MM-DD`, the last of the seven days. */
	today: string
}

/** mockups/progress.html «Калорії за тиждень»: seven bars, the goal line, its legend and both averages. Always 7 days. */
export const WeekCaloriesCard = ({ week, today }: WeekCaloriesCardProps) => {
	const { t } = useTranslation()
	const { days, goalKcal, avgKcal, avgProteinG } = week

	return (
		<Surface variant="list" radius="panel" className="flex flex-col gap-2.5 p-4">
			<div className="flex items-baseline justify-between gap-3">
				<Text as="span" variant="caption" tone="muted">
					{t('progress.week.title')}
				</Text>
				{goalKcal !== null && (
					<div className="flex items-center gap-2.5">
						<Text
							as="span"
							variant="small"
							weight="regular"
							tone="muted"
							className="flex items-center gap-1.5"
						>
							<span aria-hidden="true" className="w-4 border-t-2 border-dashed border-muted-soft" />
							{t('progress.week.goal', { value: formatInteger(goalKcal) })}
						</Text>
						<Text
							as="span"
							variant="small"
							weight="regular"
							tone="muted"
							className="flex items-center gap-1"
						>
							<span aria-hidden="true" className="size-2 bg-over" />
							{t('progress.week.legendOver')}
						</Text>
					</div>
				)}
			</div>
			<WeekBarsChart days={days} goalKcal={goalKcal} today={today} />
			{(avgKcal !== null || avgProteinG !== null) && (
				<div className="grid grid-cols-2 gap-2">
					{avgKcal !== null && (
						<AverageTile
							tone="kcal"
							label={t('progress.week.avgKcal')}
							value={t('progress.week.kcalValue', { value: formatInteger(avgKcal) })}
						/>
					)}
					{avgProteinG !== null && (
						<AverageTile
							tone="protein"
							label={t('progress.week.avgProtein')}
							value={t('progress.week.gramsValue', { value: formatInteger(avgProteinG) })}
						/>
					)}
				</div>
			)}
		</Surface>
	)
}
