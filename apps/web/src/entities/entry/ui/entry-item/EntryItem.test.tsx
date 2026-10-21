// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { FoodEntryView } from '../../model/entry.types'
import { EntryItem } from './EntryItem'

vi.mock('motion', () => ({ animate: vi.fn(() => ({ stop: vi.fn() })) }))

const entry: FoodEntryView = {
	id: 'a',
	name: 'Вівсянка на молоці',
	amount: '250 г',
	kcal: 255,
	category: 'porridge',
}

afterEach(cleanup)

describe('EntryItem caption', () => {
	it('copied: the amount, then the «як учора» mark', () => {
		renderWithProviders(
			<EntryItem entry={{ ...entry, captionState: 'copied', copiedLabel: 'як учора' }} />,
		)

		expect(screen.getByText('як учора').tagName).toBe('SPAN')
		expect(screen.getByText(/^250 г ·/)).toBeTruthy()
	})

	it('usual: the amount, then «як завжди» in the same style as the copied mark', () => {
		renderWithProviders(<EntryItem entry={{ ...entry, amount: '250 мл', captionState: 'usual' }} />)

		expect(screen.getByText('як завжди').tagName).toBe('SPAN')
		expect(screen.getByText(/^250 мл ·/)).toBeTruthy()
		expect(screen.queryByText('як учора')).toBeNull()
	})

	it('estimate: the `more` tile, «оцінка» and «≈ 300» instead of the dish', () => {
		renderWithProviders(
			<EntryItem
				entry={{
					...entry,
					name: 'Без деталей',
					kcal: 300,
					category: 'plate',
					captionState: 'estimate',
					isEstimate: true,
				}}
			/>,
		)

		expect(screen.getByText('оцінка')).toBeTruthy()
		expect(screen.getByText('≈ 300')).toBeTruthy()
		expect(document.querySelector('[data-icon="more"]')).not.toBeNull()
		expect(document.querySelector('[data-food]')).toBeNull()
	})

	it('copied without a label falls back to the plain amount', () => {
		renderWithProviders(<EntryItem entry={{ ...entry, captionState: 'copied' }} />)

		expect(screen.getByText('250 г')).toBeTruthy()
	})
})
