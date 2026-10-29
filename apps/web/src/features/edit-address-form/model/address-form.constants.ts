import type { AddressForm } from '@kus/shared'
import type { ParseKeys } from 'i18next'

/** Order of the cards in the sheet (mockups/settings-address.html). */
export const ADDRESS_FORM_ORDER: readonly AddressForm[] = ['MASCULINE', 'FEMININE', 'NEUTRAL']

export const DEFAULT_ADDRESS_FORM: AddressForm = 'NEUTRAL'

export const ADDRESS_FORM_LABEL_KEY: Record<AddressForm, ParseKeys> = {
	MASCULINE: 'settings.address.options.MASCULINE.label',
	FEMININE: 'settings.address.options.FEMININE.label',
	NEUTRAL: 'settings.address.options.NEUTRAL.label',
}
