import type { GoalType } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatPace, getPaceHintKey, PACE_OPTIONS } from '@/entities/profile'
import type { Option } from '@/shared/ui'

import { ChoiceBody } from './ChoiceBody'

interface PaceBodyProps {
	/** The pace only exists for a goal of losing or gaining; without a goal it reads as losing. */
	goalType: GoalType | null
	initialValue: number | null
	onSaved: () => void
}

/** «Вибір з підказками»: the weekly pace with how it feels. */
export const PaceBody = ({ goalType, initialValue, onSaved }: PaceBodyProps) => {
	const { t } = useTranslation()
	const goal = goalType ?? 'LOSE'
	const options: Option<string>[] = PACE_OPTIONS.map((pace) => {
		const hintKey = getPaceHintKey(goal, pace)
		return {
			value: String(pace),
			label: t('profile.data.values.pace', { pace: formatPace(pace, goal) }),
			hint: hintKey ? t(hintKey) : undefined,
		}
	})

	return (
		<ChoiceBody
			field="paceKgPerWeek"
			label={t('profile.data.fields.paceKgPerWeek')}
			options={options}
			initialValue={initialValue === null ? null : String(initialValue)}
			toRequestValue={Number}
			onSaved={onSaved}
		/>
	)
}
