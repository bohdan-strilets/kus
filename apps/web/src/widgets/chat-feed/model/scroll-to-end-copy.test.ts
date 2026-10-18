import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

describe('chat.scrollToEnd copy', () => {
	it('exists in uk and reads as the agreed label', () => {
		expect(i18n.exists('chat.scrollToEnd')).toBe(true)
		expect(i18n.t('chat.scrollToEnd')).toBe('До останніх повідомлень')
	})
})
