import 'i18next'

import type { resources } from './i18n'

// Makes t('key') type-safe: unknown keys fail typecheck
declare module 'i18next' {
	interface CustomTypeOptions {
		resources: (typeof resources)['uk']
	}
}
