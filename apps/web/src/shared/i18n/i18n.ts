import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import uk from './locales/uk.json'

export const DEFAULT_LOCALE = 'uk'

export const resources = {
	uk: { translation: uk },
} as const

void i18n.use(initReactI18next).init({
	resources,
	lng: DEFAULT_LOCALE,
	fallbackLng: DEFAULT_LOCALE,
	// React already escapes rendered text
	interpolation: { escapeValue: false },
})

export { i18n }
