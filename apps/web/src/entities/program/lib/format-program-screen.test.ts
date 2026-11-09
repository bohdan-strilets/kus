import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatProgramCreated,
	formatProgramSubtitle,
	formatProgramVersionWhen,
	formatRotateHint,
	formatRotateHintParts,
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

describe('formatRotateHint', () => {
	const named = (...names: string[]) => names.map((name, position) => ({ name, position }))

	it('shows the rotation by the short names, starting over at the end', () => {
		expect(formatRotateHint(named('Тренування А', 'Тренування Б', 'Тренування В'), t)).toBe(
			'А → Б → В → А… Наступне — те, що йде після останнього зробленого.',
		)
		expect(formatRotateHint(named('Тренування А', 'Тренування Б'), t)).toBe(
			'А → Б → А… Наступне — те, що йде після останнього зробленого.',
		)
	})

	it('orders by position and keeps a name that is not «Тренування X» whole', () => {
		expect(
			formatRotateHint(
				[
					{ name: 'Низ', position: 1 },
					{ name: 'Верх', position: 0 },
				],
				t,
			),
		).toBe('Верх → Низ → … Наступне — те, що йде після останнього зробленого.')
	})

	it('has no sequence for one template', () => {
		expect(formatRotateHint(named('Тренування А'), t)).toBe(
			'Наступне — те, що йде після останнього зробленого.',
		)
	})
})

describe('formatRotateHint with custom names', () => {
	const named = (...names: string[]) => names.map((name, position) => ({ name, position }))
	const NEXT = 'Наступне — те, що йде після останнього зробленого.'

	it('shows each custom name once and ends with «…»', () => {
		expect(formatRotateHintParts(named('Верх', 'Низ'), t)).toEqual({
			sequence: 'Верх → Низ → …',
			isTruncatable: true,
			next: NEXT,
		})
	})

	it('treats a mix of default and custom names as custom', () => {
		const parts = formatRotateHintParts(named('Тренування А', 'Низ', 'Тренування В'), t)
		expect(parts.sequence).toBe('А → Низ → В → …')
		expect(parts.isTruncatable).toBe(true)
	})

	it('orders by position', () => {
		const parts = formatRotateHintParts(
			[
				{ name: 'Низ', position: 1 },
				{ name: 'Верх', position: 0 },
			],
			t,
		)
		expect(parts.sequence).toBe('Верх → Низ → …')
		expect(formatRotateHint(named('Верх', 'Низ'), t)).toBe(`Верх → Низ → … ${NEXT}`)
	})

	it('keeps the default names starting over and not truncatable', () => {
		expect(formatRotateHintParts(named('Тренування А', 'Тренування Б'), t)).toEqual({
			sequence: 'А → Б → А…',
			isTruncatable: false,
			next: NEXT,
		})
	})

	it('has no sequence for one custom template', () => {
		expect(formatRotateHintParts(named('Верх'), t)).toEqual({
			sequence: null,
			isTruncatable: false,
			next: NEXT,
		})
	})
})
