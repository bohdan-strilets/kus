import 'i18next'

import type { resources } from './i18n'
import type devMessages from './locales/uk.dev.json'

// Makes t('key') type-safe: unknown keys fail typecheck. The dev-only /dev/ui strings are typed
// too, but loaded at runtime only by that page (add-dev-messages.ts), so they never ship.
declare module 'i18next' {
	interface CustomTypeOptions {
		resources: {
			translation: (typeof resources)['uk']['translation'] & typeof devMessages
		}
	}
}
