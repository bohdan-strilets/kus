// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import type { ProgramChangeGroup } from '../lib/format-program-changes'
import { ProgramChangeList } from './ProgramChangeList'

afterEach(cleanup)

const rows: ProgramChangeGroup['rows'] = [
	{ key: '0', kind: 'removed', title: 'Жим ногами', detail: null },
	{ key: '1', kind: 'added', title: 'Присідання', detail: '3 підходи · 8–12 повт. · 60 кг' },
	{
		key: '2',
		kind: 'changed',
		title: 'Порядок змінено',
		detail: null,
		order: ['Присідання', 'Жим'],
	},
]

const renderRows = (shown: ProgramChangeGroup['rows']) =>
	render(<ProgramChangeList groups={[{ key: 'А', label: 'Тренування А', rows: shown }]} />)

describe('ProgramChangeList', () => {
	it('keeps the rows in the order given, each with its mark and word', () => {
		const { container } = renderRows(rows)

		const items = Array.from(container.querySelectorAll('section > ul > li'))
		expect(items).toHaveLength(3)
		expect(items[0]?.textContent).toContain('−')
		expect(items[0]?.textContent).toContain('Прибрано')
		expect(items[1]?.textContent).toContain('+')
		expect(items[1]?.textContent).toContain('3 підходи · 8–12 повт. · 60 кг')
		expect(items[2]?.textContent).toContain('→')
		expect(items[2]?.textContent).toContain('Порядок змінено')
	})

	it('shows the new order as a numbered list inside the row', () => {
		const { container } = renderRows(rows)

		const names = Array.from(container.querySelectorAll('ol > li')).map((item) => item.textContent)
		expect(names).toEqual(['Присідання', 'Жим'])
	})

	it('has no numbered list for rows without an order', () => {
		const { container } = renderRows(rows.slice(0, 2))
		expect(container.querySelector('ol')).toBeNull()
	})
})
