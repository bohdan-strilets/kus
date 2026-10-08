import { useTranslation } from 'react-i18next'

import { formatDayHeading, toCalendarDate } from '@/shared/lib'
import { Heading, Icon, ICON_SIZE, IconButton, Text } from '@/shared/ui'

interface TodayHeaderProps {
	localDate: string
	title: string
	onPreviousWeek: () => void
	/** null at the current week: the button stays, disabled (mockups/today.html). */
	onNextWeek: (() => void) | null
}

/** mockups/today.html header: the date over «Сьогодні», ‹ › for the previous / next week. */
export const TodayHeader = ({ localDate, title, onPreviousWeek, onNextWeek }: TodayHeaderProps) => {
	const { t } = useTranslation()

	return (
		<header className="flex items-center justify-between px-5 pt-5.5 pb-2.5">
			<div className="flex min-w-0 flex-col gap-0.5">
				<Text as="span" variant="caption" weight="regular" tone="muted">
					{formatDayHeading(toCalendarDate(localDate))}
				</Text>
				<Heading as="h1">{title}</Heading>
			</div>
			<div className="flex gap-2">
				<IconButton variant="frosted" label={t('today.previousWeek')} onClick={onPreviousWeek}>
					<Icon name="chevron-left" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton
					variant="frosted"
					label={t('today.nextWeek')}
					onClick={onNextWeek ?? undefined}
					disabled={onNextWeek === null}
				>
					<Icon name="chevron-right" size={ICON_SIZE.control} />
				</IconButton>
			</div>
		</header>
	)
}
