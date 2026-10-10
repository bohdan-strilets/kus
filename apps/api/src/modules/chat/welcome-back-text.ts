import { type AuthUser, getAddressName } from '@kus/shared'

import { fillTemplate, getTexts } from '../../common/i18n'

export type WelcomeBackAddressee = Pick<AuthUser, 'name' | 'addressAs' | 'locale'>

/**
 * «З поверненням, Богдане!» after account-restore: the chosen address, else a safe vocative of
 * the name (the same rule as the chat greeting), else without a name.
 */
export const getWelcomeBackText = ({ name, addressAs, locale }: WelcomeBackAddressee): string => {
	const texts = getTexts(locale).welcomeBack
	const addressName = getAddressName({ name, addressAs })
	if (addressName === null) return texts.withoutName
	return fillTemplate(texts.withName, { name: addressName })
}
