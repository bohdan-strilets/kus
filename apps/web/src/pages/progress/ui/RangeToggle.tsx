import { PROGRESS_RANGES } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import type { ProgressRange } from '@/entities/progress'
import { SegmentedToggle } from '@/shared/ui'

interface RangeToggleProps {
	value: ProgressRange
	onChange: (range: ProgressRange) => void
}

/** mockups/progress.html «Період»: the shared segmented control with 7 / 30 / 90 days. */
export const RangeToggle = ({ value, onChange }: RangeToggleProps) => {
	const { t } = useTranslation()

	return (
		<SegmentedToggle
			aria-label={t('progress.range.label')}
			value={value}
			onChange={onChange}
			options={PROGRESS_RANGES.map((range) => ({
				value: range,
				label: t('progress.range.option', { days: range }),
				ariaLabel: t('progress.range.optionLabel', { days: range }),
			}))}
		/>
	)
}
