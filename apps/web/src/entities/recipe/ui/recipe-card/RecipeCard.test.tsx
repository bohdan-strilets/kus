// @vitest-environment jsdom
import type { RecipeListItem } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { RecipeCard } from './RecipeCard'

const recipe: RecipeListItem = {
	id: '0199b3a4-0000-7000-8000-000000000001',
	name: 'Курка з гречкою',
	category: 'poultry',
	kcal: 540,
	protein: 52,
	fat: 15,
	carbs: 47,
	portionGrams: 450,
	usageCount: 12,
	lastUsedAt: null,
}

afterEach(() => {
	cleanup()
})

describe('RecipeCard', () => {
	it('shows the name, kcal with grams and the usage count', () => {
		renderWithProviders(<RecipeCard recipe={recipe} to="/app/recipes/1" />)

		expect(screen.getByText('Курка з гречкою')).toBeTruthy()
		expect(screen.getByText('540 ккал · 450 г')).toBeTruthy()
		expect(screen.getByText('12×')).toBeTruthy()
	})

	it('is a link to the recipe', () => {
		renderWithProviders(<RecipeCard recipe={recipe} to="/app/recipes/1" />)

		expect(screen.getByRole('link').getAttribute('href')).toBe('/app/recipes/1')
	})
})
