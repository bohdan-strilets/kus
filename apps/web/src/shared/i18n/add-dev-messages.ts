import { DEFAULT_LOCALE, i18n } from './i18n'
import devMessages from './locales/uk.dev.json'

/**
 * Adds the /dev/ui catalogue strings. Called only from that dev-only page, so in production the
 * file is tree-shaken away together with its JSON.
 */
export const addDevMessages = (): void => {
	i18n.addResourceBundle(DEFAULT_LOCALE, 'translation', devMessages, true, true)
}
