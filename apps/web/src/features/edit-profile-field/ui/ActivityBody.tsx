import type { ProfileActivityLevel } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { ACTIVITY_HINT_KEY, ACTIVITY_LABEL_KEY } from '@/entities/profile'
import type { IconName, Option } from '@/shared/ui'

import { ChoiceBody } from './ChoiceBody'

const ACTIVITY_ICONS: Record<ProfileActivityLevel, IconName> = {
	SEDENTARY: 'desk',
	LIGHT: 'walk',
	MODERATE: 'dumbbell',
	ACTIVE: 'flame',
}

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_ICONS) as ProfileActivityLevel[]

interface ActivityBodyProps {
	initialValue: string | null
	onSaved: () => void
}

/** «Список з іконками» (as in onboarding-3): four levels with their hints. */
export const ActivityBody = ({ initialValue, onSaved }: ActivityBodyProps) => {
	const { t } = useTranslation()
	const options: Option<string>[] = ACTIVITY_LEVELS.map((level) => ({
		value: level,
		label: t(ACTIVITY_LABEL_KEY[level]),
		hint: t(ACTIVITY_HINT_KEY[level]),
		icon: ACTIVITY_ICONS[level],
	}))

	return (
		<ChoiceBody
			field="activityLevel"
			label={t('profile.data.fields.activityLevel')}
			options={options}
			initialValue={initialValue}
			onSaved={onSaved}
		/>
	)
}
