import { useTranslation } from 'react-i18next'

import { getWeekdayLongName, getWeekdayShortName, PROGRAM_WEEKDAYS } from '@/entities/program'
import { cn } from '@/shared/lib'

interface WeekdayPickerProps {
	templateName: string
	weekdays: readonly number[]
	isDisabled: boolean
	onToggle: (isoWeekday: number) => void
}

/** Пн … Нд of one template: a filled circle is a training day, a tap adds or removes it. */
export const WeekdayPicker = ({
	templateName,
	weekdays,
	isDisabled,
	onToggle,
}: WeekdayPickerProps) => {
	const { t } = useTranslation()
	return (
		<div
			role="group"
			aria-label={t('program.screen.weekdays', { name: templateName })}
			className="relative z-10 flex justify-between"
		>
			{PROGRAM_WEEKDAYS.map((day) => {
				const isSelected = weekdays.includes(day)
				return (
					<button
						key={day}
						type="button"
						aria-pressed={isSelected}
						aria-label={getWeekdayLongName(day)}
						disabled={isDisabled}
						onClick={() => {
							onToggle(day)
						}}
						// a real 44×44 box around the 36px circle (the mockup's circle)
						className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full text-small font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default"
					>
						<span
							className={cn(
								'flex size-9 items-center justify-center rounded-full',
								isSelected ? 'bg-hint-training-ink text-white' : 'bg-field text-muted',
							)}
						>
							{getWeekdayShortName(day)}
						</span>
					</button>
				)
			})}
		</div>
	)
}
