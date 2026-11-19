// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { NewRecipeIntro } from './NewRecipeIntro'

afterEach(cleanup)

describe('NewRecipeIntro', () => {
	it('shows the pill, the explanation and the example', () => {
		renderWithProviders(<NewRecipeIntro />)

		expect(screen.getByText('Новий рецепт')).toBeTruthy()
		expect(
			screen.getByText(
				'Опиши страву, як розповів би другу: що входить і скільки. Я порахую калорії на порцію й збережу рецепт.',
			),
		).toBeTruthy()
		expect(screen.getByText(/^Наприклад: «борщ на 3 літри/)).toBeTruthy()
	})
})
