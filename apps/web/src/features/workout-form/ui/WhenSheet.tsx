import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, Chip, Text } from '@/shared/ui'

import { formatDateOption } from '../lib/format-date-option'
import { getFormDateOptions } from '../lib/get-date-options'

interface WhenSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** The user's today, `YYYY-MM-DD`. */
	today: string
	localDate: string
	/** `HH:mm`. */
	startTime: string
	onApply: (value: { localDate: string; startTime: string }) => void
}

/**
 * mockups/training-form.html «Коли було»: the day (today and up to three days back, as for food)
 * and the start time. «Готово» applies both; closing the sheet leaves the form as it was.
 */
export const WhenSheet = ({
	isOpen,
	onOpenChange,
	today,
	localDate,
	startTime,
	onApply,
}: WhenSheetProps) => {
	const { t } = useTranslation()
	const [draftDate, setDraftDate] = useState(localDate)
	const [draftTime, setDraftTime] = useState(startTime)
	const [wasOpen, setWasOpen] = useState(isOpen)
	// every opening starts from what the form holds
	if (isOpen !== wasOpen) {
		setWasOpen(isOpen)
		if (isOpen) {
			setDraftDate(localDate)
			setDraftTime(startTime)
		}
	}

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('training.form.whenTitle')}
		>
			<div className="flex flex-col gap-1.5">
				<Text as="span" variant="small" tone="muted" weight="semibold">
					{t('training.form.day')}
				</Text>
				<div className="flex flex-wrap gap-1.5">
					{getFormDateOptions(today).map((option) => (
						<Chip
							key={option.localDate}
							variant="choice"
							isSelected={option.localDate === draftDate}
							onClick={() => {
								setDraftDate(option.localDate)
							}}
						>
							{formatDateOption(option, t)}
						</Chip>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<Text as="span" variant="small" tone="muted" weight="semibold">
					{t('training.form.start')}
				</Text>
				<input
					type="time"
					aria-label={t('training.form.start')}
					value={draftTime}
					onChange={(event) => {
						setDraftTime(event.target.value)
					}}
					className="min-h-button rounded-field bg-field px-3.5 text-input font-semibold text-ink"
				/>
			</div>
			<Text variant="small" tone="muted" weight="regular">
				{t('training.form.whenHint')}
			</Text>
			<Button
				isFullWidth
				onClick={() => {
					onApply({ localDate: draftDate, startTime: draftTime })
					onOpenChange(false)
				}}
			>
				{t('training.form.whenDone')}
			</Button>
		</BaseBottomSheet>
	)
}
