// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { BottomNav } from './BottomNav'

afterEach(cleanup)

const getLabels = (): (string | null)[] =>
	within(screen.getByRole('navigation', { name: 'Основна навігація' }))
		.getAllByRole('link')
		.map((link) => link.textContent)

describe('BottomNav', () => {
	it('four tabs while «Тренування» is off', () => {
		renderWithProviders(<BottomNav hasTraining={false} />, { route: '/app' })

		expect(getLabels()).toEqual(['Чат', 'Сьогодні', 'Прогрес', 'Рецепти'])
	})

	it('five tabs with «Чат» in the middle', () => {
		renderWithProviders(<BottomNav hasTraining />, { route: '/app' })

		expect(getLabels()).toEqual(['Сьогодні', 'Рецепти', 'Чат', 'Тренування', 'Прогрес'])
	})

	it('the raised «Чат» is the active tab on /app, the others are not', () => {
		renderWithProviders(<BottomNav hasTraining />, { route: '/app' })

		expect(screen.getByRole('link', { name: 'Чат' }).getAttribute('aria-current')).toBe('page')
		expect(screen.getByRole('link', { name: 'Тренування' }).getAttribute('aria-current')).toBeNull()
	})

	it('«Тренування» is active on its route and «Чат» is not', () => {
		renderWithProviders(<BottomNav hasTraining />, { route: '/app/training' })

		expect(screen.getByRole('link', { name: 'Тренування' }).getAttribute('aria-current')).toBe(
			'page',
		)
		expect(screen.getByRole('link', { name: 'Чат' }).getAttribute('aria-current')).toBeNull()
		expect(screen.getByRole('link', { name: 'Чат' }).getAttribute('href')).toBe('/app')
	})

	it('the five-tab labels are tighter and never wrap; four tabs keep the normal tracking', () => {
		renderWithProviders(<BottomNav hasTraining />, { route: '/app' })
		const training = screen.getByRole('link', { name: 'Тренування' })
		expect(training.className).toContain('tracking-nav')
		expect(training.className).toContain('whitespace-nowrap')
		cleanup()

		renderWithProviders(<BottomNav hasTraining={false} />, { route: '/app' })
		expect(screen.getByRole('link', { name: 'Прогрес' }).className).not.toContain('tracking-nav')
	})

	it('four tabs by default: the flag is off', () => {
		renderWithProviders(<BottomNav />, { route: '/app' })

		expect(getLabels()).toHaveLength(4)
	})
})
