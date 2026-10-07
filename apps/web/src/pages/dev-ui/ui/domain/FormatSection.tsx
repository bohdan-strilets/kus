import { useTranslation } from 'react-i18next'

import {
	formatDayHeading,
	formatDecimal,
	formatInteger,
	formatSignedDecimal,
	formatSignedInteger,
	formatTime,
	formatWeekdayShort,
} from '@/shared/lib'
import { Text } from '@/shared/ui'

import { SEED_TODAY } from '../../model/seed'
import { DevSection } from '../DevSection'

const BREAKFAST_TIME = new Date(2026, 9, 5, 8, 40)

// function calls are code, shown as-is next to what they return for the seed data
const EXAMPLES = [
	['formatInteger(1370)', formatInteger(1370)],
	['formatDecimal(82.4)', formatDecimal(82.4)],
	['formatSignedInteger(180)', formatSignedInteger(180)],
	['formatSignedDecimal(-1.6)', formatSignedDecimal(-1.6)],
	['formatTime(08:40)', formatTime(BREAKFAST_TIME)],
	['formatDayHeading(5.10)', formatDayHeading(SEED_TODAY)],
	['formatWeekdayShort(5.10)', formatWeekdayShort(SEED_TODAY)],
] as const

export const FormatSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.format')}>
			<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-card bg-surface p-4 shadow-card">
				{EXAMPLES.map(([call, result]) => (
					<div key={call} className="contents">
						<Text as="span" variant="small" weight="regular" tone="muted">
							{call}
						</Text>
						<Text as="span" variant="cardTitle" isTabular>
							{result}
						</Text>
					</div>
				))}
			</div>
		</DevSection>
	)
}
