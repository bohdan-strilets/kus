import { motion } from 'motion/react'
import { useState } from 'react'
import { type UseFormReturn, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
	formatDateOption,
	getFormDateOptions,
	type WorkoutFormValues,
	WhenSheet,
} from '@/features/workout-form'
import { PRESS } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

interface FillWhenCardProps {
	form: UseFormReturn<WorkoutFormValues>
	today: string
	onApply: (value: { localDate: string; startTime: string }) => void
}

/** «Коли · Сьогодні · 18:30»: the card opens the sheet with the day and the start time. */
export const FillWhenCard = ({ form, today, onApply }: FillWhenCardProps) => {
	const { t } = useTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [localDate, startTime] = useWatch({
		control: form.control,
		name: ['localDate', 'startTime'],
	})
	const { errors } = form.formState
	const error = errors.localDate?.message ?? errors.startTime?.message
	const option = getFormDateOptions(today).find((item) => item.localDate === localDate)
	const dayText = option ? formatDateOption(option, t) : localDate

	return (
		<>
			<motion.button
				type="button"
				onClick={() => {
					setIsOpen(true)
				}}
				{...PRESS}
				className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-field bg-surface px-3.5 py-2.5 text-left shadow-field"
			>
				<Icon name="calendar" size={ICON_SIZE.control} className="flex-none text-muted-strong" />
				<span className="flex min-w-0 flex-col">
					<Text as="span" variant="small" tone={error ? 'danger' : 'muted'}>
						{t('training.form.when')}
					</Text>
					<Text as="span" variant="body" weight="bold" className="truncate">
						{`${dayText} · ${startTime}`}
					</Text>
				</span>
			</motion.button>
			{error && (
				<Text role="alert" variant="caption" tone="danger" className="col-span-2">
					{error}
				</Text>
			)}
			<WhenSheet
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				today={today}
				localDate={localDate}
				startTime={startTime}
				onApply={onApply}
			/>
		</>
	)
}
