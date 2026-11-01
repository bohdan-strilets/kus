import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatProgramCreated,
	formatProgramSubtitle,
	formatProgramVersionWhen,
} from './format-program-screen'

const t = i18n.t.bind(i18n)

const templates = (count: number) => Array.from({ length: count }, () => ({}) as never)

describe('formatProgramSubtitle', () => {
	it('joins the title, the templates and the days a week', () => {
		expect(
			formatProgramSubtitle({ title: 'Все тіло', templates: templates(2), perWeek: 3 }, t),
		).toBe('Все тіло · 2 тренування · 3 рази на тиждень')
	})

	it('skips the parts the program does not have', () => {
		expect(formatProgramSubtitle({ title: null, templates: templates(1), perWeek: null }, t)).toBe(
			'1 тренування',
		)
		expect(formatProgramSubtitle({ title: null, templates: templates(5), perWeek: 1 }, t)).toBe(
			'5 тренувань · 1 раз на тиждень',
		)
	})
})

describe('formatProgramVersionWhen', () => {
	const createdAt = new Date(2026, 9, 31, 20, 15).toISOString()

	it('tells the day and the time', () => {
		expect(formatProgramVersionWhen({ createdAt, isCurrent: false }, t)).toBe('31 жовтня, 20:15')
	})

	it('marks the current version', () => {
		expect(formatProgramVersionWhen({ createdAt, isCurrent: true }, t)).toBe(
			'31 жовтня, 20:15 · поточна',
		)
	})
})

describe('formatProgramCreated', () => {
	it('tells the templates and the mode of the first version', () => {
		expect(formatProgramCreated({ templates: templates(2), mode: 'ROTATE' }, t)).toBe(
			'Програму створено: 2 тренування, по черзі.',
		)
	})

	it('has no numbers when the program has moved on', () => {
		expect(formatProgramCreated(null, t)).toBe('Програму створено.')
	})
})
