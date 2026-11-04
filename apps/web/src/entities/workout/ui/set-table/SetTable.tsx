import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import type { SetTableProps } from './set-table.types'

/**
 * mockups/training-live.html, training-form.html: the sets that are edited as a table «Підхід · Вага ·
 * Повтори». The header is decoration (every row says its own numbers), the columns line up with
 * `SetRow`: a 44px number, two equal fields and a 44px place for the ✓.
 */
export const SetTable = ({ hasWeight, children }: SetTableProps) => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-1.5">
			<div aria-hidden="true" className="flex gap-2.5 pr-1.5 pl-3">
				<Text as="span" variant="small" tone="muted" className="w-11 flex-none">
					{t('workout.table.set')}
				</Text>
				{hasWeight && (
					<Text as="span" variant="small" tone="muted" className="min-w-0 flex-1 basis-0">
						{t('workout.table.weight')}
					</Text>
				)}
				<Text as="span" variant="small" tone="muted" className="min-w-0 flex-1 basis-0">
					{t('workout.table.reps')}
				</Text>
				<span className="w-11 flex-none" />
			</div>
			{children}
		</div>
	)
}
