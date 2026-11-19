// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Route, Routes, useLocation } from 'react-router'

import { getChatEntryIntent } from '@/features/send-message'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { renderWithProviders } from '@/shared/testing'

import { RecipesPage } from './RecipesPage'

const getMock = vi.spyOn(httpClient, 'get')
const RECIPE_ID = '0199b3a4-0000-7000-8000-000000000001'

const makeRecipe = (id: string, name: string) => ({
	id,
	name,
	category: 'borscht',
	kcal: 190,
	protein: 8,
	fat: 7,
	carbs: 24,
	portionGrams: 350,
	usageCount: 7,
	lastUsedAt: null,
})

const page = (data: unknown[]): AxiosResponse => ({
	data: { data, meta: { total: data.length, page: 1, limit: 50, totalPages: 1 } },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

/** Stands for the chat: shows the intent the navigation arrived with. */
const ChatProbe = () => {
	const location = useLocation()
	return <p>{`chat intent: ${getChatEntryIntent(location.state) ?? 'none'}`}</p>
}

const renderPage = () =>
	renderWithProviders(
		<Routes>
			<Route path="/" element={<RecipesPage />} />
			<Route path={ROUTES.chat} element={<ChatProbe />} />
		</Routes>,
		{ queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
	)

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('RecipesPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderPage()
		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('lists the recipes as links to their screens and a tile to the chat', async () => {
		getMock.mockResolvedValue(
			page([
				makeRecipe(RECIPE_ID, 'Борщ'),
				makeRecipe('0199b3a4-0000-7000-8000-000000000002', 'Сирники'),
			]),
		)
		renderPage()

		const link = await screen.findByRole('link', { name: /Борщ/ })
		expect(link.getAttribute('href')).toBe(`/app/recipes/${RECIPE_ID}`)
		expect(screen.getAllByText('190 ккал · 350 г')).toHaveLength(2)
		expect(screen.getByRole('heading', { level: 1, name: 'Рецепти' })).toBeTruthy()
		expect(screen.getByRole('link', { name: 'Новий рецепт' }).getAttribute('href')).toBe('/app')
		expect(screen.getByRole('link', { name: /Опиши страву/ }).getAttribute('href')).toBe('/app')
		expect(getMock).toHaveBeenCalledWith('/recipes', { params: { limit: 50 } })
	})

	it('shows the empty state with a way to the chat', async () => {
		getMock.mockResolvedValue(page([]))
		renderPage()

		expect(await screen.findByRole('heading', { name: 'Тут житимуть твої страви' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Описати страву в чаті' })).toBeTruthy()
		expect(screen.queryByRole('link', { name: /Опиши страву/ })).toBeNull()
	})

	it('the «+» opens the chat in «Новий рецепт»', async () => {
		getMock.mockResolvedValue(page([makeRecipe(RECIPE_ID, 'Борщ')]))
		renderPage()

		fireEvent.click(await screen.findByRole('link', { name: 'Новий рецепт' }))

		expect(screen.getByText('chat intent: new_recipe')).toBeTruthy()
	})

	it('the tile opens the chat in «Новий рецепт»', async () => {
		getMock.mockResolvedValue(page([makeRecipe(RECIPE_ID, 'Борщ')]))
		renderPage()

		fireEvent.click(await screen.findByRole('link', { name: /Опиши страву/ }))

		expect(screen.getByText('chat intent: new_recipe')).toBeTruthy()
	})

	it('the button of the empty state opens the chat in «Новий рецепт»', async () => {
		getMock.mockResolvedValue(page([]))
		renderPage()

		fireEvent.click(await screen.findByRole('button', { name: 'Описати страву в чаті' }))

		expect(screen.getByText('chat intent: new_recipe')).toBeTruthy()
	})

	it('shows an inline error and retries', async () => {
		getMock.mockRejectedValueOnce(new AxiosError('boom'))
		renderPage()

		const alert = await screen.findByRole('alert')
		expect(alert.textContent).toContain('Не вдалося завантажити')

		getMock.mockResolvedValue(page([makeRecipe(RECIPE_ID, 'Борщ')]))
		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByRole('link', { name: /Борщ/ })).toBeTruthy()
	})

	it('keeps «Мої продукти» and the search hidden', async () => {
		getMock.mockResolvedValue(page([makeRecipe(RECIPE_ID, 'Борщ')]))
		renderPage()
		await screen.findByRole('link', { name: /Борщ/ })

		expect(screen.queryByText(/Мої продукти/)).toBeNull()
		expect(screen.queryByRole('tablist')).toBeNull()
		expect(screen.queryByRole('searchbox')).toBeNull()
		expect(screen.queryByPlaceholderText('Пошук страв і продуктів')).toBeNull()
	})
})
