// @vitest-environment jsdom
import type { MyFoodResponse } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { EditMyFoodSheet } from './EditMyFoodSheet'

const FOOD: MyFoodResponse = {
	id: '7a1b2c3d-0000-4000-8000-000000000001',
	name: 'Ківі',
	brand: null,
	aliases: [],
	per100g: { kcal: 61, protein: 1, fat: 0.5, carbs: 15, fiber: 3 },
	pieceGrams: null,
	defaultGrams: null,
	category: 'fruit',
	source: 'CHAT',
	updatedAt: '2026-10-01T10:00:00.000Z',
} as unknown as MyFoodResponse

afterEach(cleanup)

describe('EditMyFoodSheet', () => {
	it('opens without focusing a field, so the keyboard waits for a tap', () => {
		renderWithProviders(<EditMyFoodSheet food={FOOD} onClose={vi.fn()} />)

		const nameInput = screen.getByDisplayValue('Ківі')
		expect(document.activeElement).not.toBe(nameInput)
		expect(document.activeElement?.tagName).not.toBe('INPUT')
	})

	it('gives the name input a neutral name so iOS offers no contact autofill', () => {
		renderWithProviders(<EditMyFoodSheet food={FOOD} onClose={vi.fn()} />)

		const nameInput = screen.getByDisplayValue('Ківі')
		expect(nameInput.getAttribute('name')).not.toBe('name')
		expect(nameInput.getAttribute('autocomplete')).toBe('off')
	})

	it('renders «Зберегти» and «Видалити» in the sticky footer', () => {
		renderWithProviders(<EditMyFoodSheet food={FOOD} onClose={vi.fn()} />)

		const footer = screen.getByRole('button', { name: 'Зберегти' }).parentElement
		expect(footer?.className).toContain('sticky')
		expect(footer?.className).toContain('bottom-0')
		expect(footer?.contains(screen.getByRole('button', { name: /Видалити/ }))).toBe(true)
	})
})
