import type { GoalType, ProfileResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GOAL_TYPE_LABEL_KEY, type ProfileFieldKey } from '@/entities/profile'
import { formatDecimal } from '@/shared/lib'
import { BaseBottomSheet } from '@/shared/ui'

import { getFieldValue } from '../lib/get-field-value'
import { FIELD_DEFINITIONS } from '../model/field-definitions'
import { ActivityBody } from './ActivityBody'
import { NumberBody } from './NumberBody'
import { OptionsBody } from './OptionsBody'
import { PaceBody } from './PaceBody'

export interface EditProfileFieldSheetProps {
	/** The row being edited; null — closed. */
	field: ProfileFieldKey | null
	profile: ProfileResponse
	onClose: () => void
}

const DECIMAL_DIGITS = 1

const toInputText = (value: string | number | null, isInteger: boolean): string => {
	if (typeof value !== 'number') return ''
	return isInteger ? String(value) : formatDecimal(value, DECIMAL_DIGITS)
}

/** mockups/my-data-edit-sheet.html: one sheet for every row, its body depends on the field. */
export const EditProfileFieldSheet = ({ field, profile, onClose }: EditProfileFieldSheetProps) => {
	const { t } = useTranslation()
	// the sheet slides out with its content, so the last field stays until it is gone
	const [shown, setShown] = useState<ProfileFieldKey | null>(field)
	if (field !== null && field !== shown) setShown(field)

	const definition = shown ? FIELD_DEFINITIONS[shown] : null
	const value = shown ? getFieldValue(profile, shown) : null
	const goalType: GoalType | null = profile.profile.goalType
	const description =
		shown === 'paceKgPerWeek' && goalType
			? t('profile.data.edit.paceSubtitle', { goal: t(GOAL_TYPE_LABEL_KEY[goalType]) })
			: undefined

	const renderBody = () => {
		if (!shown || !definition) return null
		switch (definition.kind) {
			case 'choice':
				return (
					<OptionsBody
						key={shown}
						field={shown}
						options={definition.options}
						initialValue={typeof value === 'string' ? value : null}
						onSaved={onClose}
					/>
				)
			case 'number':
				return (
					<NumberBody
						key={shown}
						field={shown}
						definition={definition}
						initialValue={toInputText(value, definition.isInteger)}
						onSaved={onClose}
					/>
				)
			case 'activity':
				return (
					<ActivityBody
						key={shown}
						initialValue={typeof value === 'string' ? value : null}
						onSaved={onClose}
					/>
				)
			case 'pace':
				return (
					<PaceBody
						key={shown}
						goalType={goalType}
						initialValue={typeof value === 'number' ? value : null}
						onSaved={onClose}
					/>
				)
		}
	}

	return (
		<BaseBottomSheet
			isOpen={field !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
			title={shown ? t(`profile.data.fields.${shown}`) : ''}
			description={description}
			initialFocus="first-field"
		>
			{renderBody()}
		</BaseBottomSheet>
	)
}
