import { useTranslation } from 'react-i18next'

import { getLocalHour } from '@/shared/lib'

import { type Addressee, getAddressName } from '@kus/shared'
import { getGreetingKey } from '../lib/get-greeting-key'

/**
 * «Добрий вечір, Богдане» in the user's timezone: the chosen address, else a safe vocative of the
 * name (@kus/shared), else just «Добрий вечір».
 */
export const useGreeting = ({
	addressee,
	timeZone,
}: {
	addressee: Addressee
	timeZone: string
}): string => {
	const { t } = useTranslation()
	const greeting = t(getGreetingKey(getLocalHour(new Date(), timeZone)))
	const name = getAddressName(addressee)
	return name === null ? greeting : t('chat.greetingWithName', { greeting, name })
}
