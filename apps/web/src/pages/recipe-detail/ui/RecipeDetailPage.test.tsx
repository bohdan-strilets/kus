// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useComposerDraftStore } from '@/features/send-message'
import { httpClient } from '@/shared/api'
import { getRecipePath, RECIPE_ROUTE } from '@/shared/config'
import { renderWithProviders } from '@/shared/testing'

import { RecipeDetailPage } from './RecipeDetailPage'

const getMock = vi.spyOn(httpClient, 'get')
const RECIPE_ID = '0199b3a4-0000-7000-8000-000000000001'

const values = { kcal: 540, protein: 52, fat: 15, carbs: 47 }
const recipe = {
	...values,
	id: RECIPE_ID,
	name: 'Курка з гречкою',
	category: 'porridge',
	portionGrams: 450,
	cookedGrams: 450,
	usageCount: 12,
	lastUsedAt: null,
	ingredients: [
		{
			...values,
			id: '0199b3a4-0000-7000-8000-0000000000a1',
			name: 'Куряче філе',
			grams: 200,
			kcal: 220,
		},
		{
			...values,
			id: '0199b3a4-0000-7000-8000-0000000000a2',
			name: 'Гречка варена',
			grams: 200,
			kcal: 220,
		},
	],
	portions: [
		{ ...values, share: 0.5, grams: 225, kcal: 270 },
		{ ...values, share: 1, grams: 450 },
		{ ...values, share: 1.5, grams: 675, kcal: 810 },
	],
}

const reply = (data: unknown): AxiosResponse => ({
	data: { data },
	status: 200,
	statusText: 'OK',
	headers: {},
	config: { headers: new AxiosHeaders() },
})

const httpError = (status: number, errorCode: string): AxiosError =>
	new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
		data: { statusCode: status, errorCode, details: {} },
		status,
		statusText: '',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

const renderAt = (path: string, onPathname?: (pathname: string) => void) =>
	renderWithProviders(
		<Routes>
			<Route path={RECIPE_ROUTE} element={<RecipeDetailPage />} />
		</Routes>,
		{
			route: path,
			onPathname,
			queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
		},
	)

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe('RecipeDetailPage', () => {
	it('shows a skeleton while loading', () => {
		getMock.mockReturnValue(new Promise(() => undefined))
		renderAt(getRecipePath(RECIPE_ID))
		expect(screen.getByRole('status', { name: 'Завантаження' })).toBeTruthy()
	})

	it('shows the recipe: the line, the figures, the composition and the actions', async () => {
		getMock.mockResolvedValue(reply(recipe))
		renderAt(getRecipePath(RECIPE_ID))

		expect(await screen.findByRole('heading', { name: 'Курка з гречкою' })).toBeTruthy()
		expect(screen.getByText('1 порція · 450 г · додано 12 разів')).toBeTruthy()
		expect(screen.getByText('Ккал').parentElement?.textContent).toBe('Ккал540')
		expect(screen.getByText('Білки').parentElement?.textContent).toBe('Білки52 г')
		expect(screen.getByText('Вугл.').parentElement?.textContent).toBe('Вугл.47 г')
		expect(screen.getByText('Жири').parentElement?.textContent).toBe('Жири15 г')
		expect(screen.getByText('Куряче філе')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Додати на сьогодні' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Видалити рецепт' })).toBeTruthy()
	})

	it('leaves out «додано» for a recipe never added', async () => {
		getMock.mockResolvedValue(reply({ ...recipe, usageCount: 0 }))
		renderAt(getRecipePath(RECIPE_ID))

		expect(await screen.findByText('1 порція · 450 г')).toBeTruthy()
	})

	it('has no whole-dish label when the portion is the whole dish', async () => {
		getMock.mockResolvedValue(reply(recipe))
		renderAt(getRecipePath(RECIPE_ID))
		await screen.findByRole('heading', { name: 'Курка з гречкою' })

		expect(screen.queryByText(/на всю страву/)).toBeNull()
	})

	it('labels the whole dish next to the composition when the portion is smaller', async () => {
		getMock.mockResolvedValue(reply({ ...recipe, portionGrams: 300, cookedGrams: 900 }))
		renderAt(getRecipePath(RECIPE_ID))

		expect(await screen.findByText('1 порція · 300 г · додано 12 разів')).toBeTruthy()
		expect(screen.getByText('на всю страву · 900 г')).toBeTruthy()
	})

	it('«Змінити склад у чаті» sits inside the portion card, as a 44px-tall link', async () => {
		getMock.mockResolvedValue(reply(recipe))
		renderAt(getRecipePath(RECIPE_ID))
		await screen.findByRole('heading', { name: 'Курка з гречкою' })

		const link = screen.getByRole('button', { name: 'Змінити склад у чаті' })
		const add = screen.getByRole('button', { name: 'Додати на сьогодні' })

		expect(add.parentElement?.contains(link)).toBe(true)
		expect(link.className).toContain('min-h-tap')
	})

	it('«Змінити склад у чаті» opens the chat with the name in the field', async () => {
		useComposerDraftStore.setState({ text: '', isFocusRequested: false })
		getMock.mockResolvedValue(reply(recipe))
		const pathnames: string[] = []
		renderAt(getRecipePath(RECIPE_ID), (pathname) => {
			pathnames.push(pathname)
		})
		await screen.findByRole('heading', { name: 'Курка з гречкою' })

		fireEvent.click(screen.getByRole('button', { name: 'Змінити склад у чаті' }))

		expect(useComposerDraftStore.getState()).toMatchObject({
			text: 'Зміни склад «Курка з гречкою»: ',
			isFocusRequested: true,
		})
		expect(pathnames.at(-1)).toBe('/app')
	})

	it('says the recipe is not found on a 404', async () => {
		getMock.mockRejectedValue(httpError(404, 'RECIPE_NOT_FOUND'))
		renderAt(getRecipePath(RECIPE_ID))

		expect(await screen.findByRole('heading', { name: 'Рецепт не знайдено' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'До рецептів' })).toBeTruthy()
	})

	it('treats an id that is no uuid as not found, without a request', () => {
		renderAt(getRecipePath('abc'))

		expect(screen.getByRole('heading', { name: 'Рецепт не знайдено' })).toBeTruthy()
		expect(getMock).not.toHaveBeenCalled()
	})

	it('shows an inline error on another failure and retries', async () => {
		getMock.mockRejectedValueOnce(httpError(500, 'INTERNAL'))
		renderAt(getRecipePath(RECIPE_ID))

		const alert = await screen.findByRole('alert')
		expect(alert.textContent).toContain('Не вдалося завантажити')

		getMock.mockResolvedValue(reply(recipe))
		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
		expect(await screen.findByRole('heading', { name: 'Курка з гречкою' })).toBeTruthy()
	})
})
