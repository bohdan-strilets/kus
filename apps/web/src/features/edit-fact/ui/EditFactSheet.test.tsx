// @vitest-environment jsdom
import type { FactResponse } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { EditFactSheet } from './EditFactSheet'

const FACT = {
	id: '7a1b2c3d-0000-4000-8000-000000000002',
	text: 'Не їм глютен',
	category: 'DIET',
	status: 'ACTIVE',
	createdAt: '2026-10-12T10:00:00.000Z',
} as unknown as FactResponse

// the textarea autosizes through ResizeObserver, which jsdom lacks
beforeEach(() => {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
})

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

describe('EditFactSheet', () => {
	it('opens without focusing the field and turns autocomplete off', () => {
		renderWithProviders(<EditFactSheet fact={FACT} onClose={vi.fn()} />)

		const field = screen.getByDisplayValue('Не їм глютен')
		expect(document.activeElement).not.toBe(field)
		expect(field.getAttribute('autocomplete')).toBe('off')
	})

	it('renders «Зберегти» and «Видалити» in the sticky footer', () => {
		renderWithProviders(<EditFactSheet fact={FACT} onClose={vi.fn()} />)

		const footer = screen.getByRole('button', { name: 'Зберегти' }).parentElement
		expect(footer?.className).toContain('sticky')
		expect(footer?.contains(screen.getByRole('button', { name: /Видалити/ }))).toBe(true)
	})
})
