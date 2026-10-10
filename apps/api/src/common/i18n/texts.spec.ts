import { describe, expect, it } from 'vitest'

import { Locale } from '../../generated/prisma/client'
import { fillTemplate, getTexts } from './texts'

describe('backend texts', () => {
	it('fills a placeholder and leaves an unknown one visible', () => {
		expect(fillTemplate('Привіт, {{name}}!', { name: 'Богдане' })).toBe('Привіт, Богдане!')
		expect(fillTemplate('{{name}} {{missing}}', { name: 'Бо' })).toBe('Бо {{missing}}')
	})

	it('answers in Ukrainian for every locale until pl and en ship', () => {
		for (const locale of Object.values(Locale)) {
			expect(getTexts(locale).welcomeBack.withoutName).toMatch(/^З поверненням!/)
		}
	})
})
