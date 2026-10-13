import { PROGRESS_RANGES } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import type { ProgressRange } from '@/entities/progress'
import { cn } from '@/shared/lib'

interface RangeToggleProps {
	value: ProgressRange
	onChange: (range: ProgressRange) => void
}

/**
 * mockups/progress.html «Період»: a segmented control of buttons (aria-pressed), the active one a
 * dark pill. The 34px pill gets a 44px tap area through an invisible ::after.
 */
export const RangeToggle = ({ value, onChange }: RangeToggleProps) => {
	const { t } = useTranslation()

	return (
		<div
			role="group"
			aria-label={t('progress.range.label')}
			className="flex rounded-chip bg-surface/75 p-1"
		>
			{PROGRESS_RANGES.map((range) => {
				const isSelected = range === value
				return (
					<button
						key={range}
						type="button"
						aria-pressed={isSelected}
						aria-label={t('progress.range.optionLabel', { days: range })}
						onClick={() => {
							onChange(range)
						}}
						className={cn(
							'relative min-h-8.5 cursor-pointer rounded-tile-sm px-3 text-caption after:absolute after:inset-x-0 after:-inset-y-1.25',
							isSelected ? 'bg-ink font-bold text-white' : 'font-semibold text-muted-strong',
						)}
					>
						{t('progress.range.option', { days: range })}
					</button>
				)
			})}
		</div>
	)
}
