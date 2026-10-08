import { useTranslation } from 'react-i18next'

import { getLocalHour, getVocative } from '@/shared/lib'

import { getGreetingKey } from '../lib/get-greeting-key'

/**
 * «Добрий вечір, Богдане» in the user's timezone; without a safe vocative of the name — just
 * «Добрий вечір» (shared/lib/vocative).
 */
export const useGreeting = ({ name, timeZone }: { name: string; timeZone: string }): string => {
	const { t } = useTranslation()
	const greeting = t(getGreetingKey(getLocalHour(new Date(), timeZone)))
	const vocative = getVocative(name)
	return vocative === null ? greeting : t('chat.greetingWithName', { greeting, name: vocative })
}
