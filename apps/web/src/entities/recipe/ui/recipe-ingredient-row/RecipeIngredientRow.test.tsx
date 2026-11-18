// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { RecipeIngredientRow } from './RecipeIngredientRow'

afterEach(() => {
	cleanup()
})

describe('RecipeIngredientRow', () => {
	it('shows the name, the grams and the kcal', () => {
		renderWithProviders(<RecipeIngredientRow name="Гречка варена" grams={200} kcal={220} />)

		expect(screen.getByText(/Гречка варена/)).toBeTruthy()
		expect(screen.getByText('· 200 г')).toBeTruthy()
		expect(screen.getByText('220')).toBeTruthy()
	})
})
