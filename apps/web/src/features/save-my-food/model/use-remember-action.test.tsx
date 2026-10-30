// @vitest-environment jsdom
import type { FoodEntryResponse } from '@kus/shared'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIsOverlayOpen } from '@/shared/lib'
import type * as sharedLib from '@/shared/lib'
import { renderHookWithProviders } from '@/shared/testing'

import { postRememberEntries } from '../api/remember-entries'
import { useRememberAction } from './use-remember-action'

vi.mock('../api/remember-entries', () => ({
	postRememberEntries: vi.fn(),
}))
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<typeof sharedLib>()),
	playSound: vi.fn(),
}))

const postMock = vi.mocked(postRememberEntries)
const entry = (id: string, name: string, canRemember: boolean): FoodEntryResponse =>
	({ id, name, canRemember }) as unknown as FoodEntryResponse

const ONE = [entry('a', 'Кабаноси', true), entry('b', 'Хліб', false)]
const SEVERAL = [entry('a', 'Кабаноси', true), entry('b', 'Хліб', true)]

beforeEach(() => {
	postMock.mockReset()
	postMock.mockResolvedValue({ created: [], skipped: [] })
})

afterEach(cleanup)

describe('useRememberAction', () => {
	it('is hidden when no line can be remembered', () => {
		const { result } = renderHookWithProviders(() => useRememberAction([entry('a', 'X', false)]))
		expect(result.current.isVisible).toBe(false)
	})

	it('saves the only new line at once, without the sheet', async () => {
		const { result } = renderHookWithProviders(() => useRememberAction(ONE))

		act(() => {
			result.current.press()
		})

		await waitFor(() => {
			expect(result.current.rememberedNames).toEqual(['Кабаноси'])
		})
		expect(postMock.mock.calls[0]?.[0]).toEqual({ entryIds: ['a'] })
		expect(result.current.isSheetOpen).toBe(false)
	})

	it('opens the sheet when several lines are new', () => {
		const { result } = renderHookWithProviders(() => useRememberAction(SEVERAL))

		act(() => {
			result.current.press()
		})

		expect(result.current.isSheetOpen).toBe(true)
		expect(postMock).not.toHaveBeenCalled()
	})

	it('counts a skipped «exists» line as remembered and closes the sheet', async () => {
		postMock.mockResolvedValue({ created: [], skipped: [{ entryId: 'b', reason: 'exists' }] })
		const { result } = renderHookWithProviders(() => useRememberAction(SEVERAL))

		act(() => {
			result.current.press()
		})
		await act(async () => {
			await result.current.submit(['a', 'b'])
		})

		expect(result.current.rememberedNames).toEqual(['Кабаноси', 'Хліб'])
		expect(result.current.isSheetOpen).toBe(false)
	})

	it('adds a second save to the line instead of replacing the first', async () => {
		postMock.mockResolvedValue({ created: [], skipped: [] })
		const { result } = renderHookWithProviders(() => useRememberAction(SEVERAL))

		await act(async () => {
			await result.current.submit(['a'])
		})
		await act(async () => {
			await result.current.submit(['b'])
		})

		expect(result.current.rememberedNames).toEqual(['Кабаноси', 'Хліб'])
	})

	it('keeps the button and the sheet when the request fails', async () => {
		postMock.mockRejectedValue(new Error('boom'))
		const { result } = renderHookWithProviders(() => useRememberAction(SEVERAL))

		act(() => {
			result.current.press()
		})
		await act(async () => {
			await result.current.submit(['a'])
		})

		expect(result.current.rememberedNames).toEqual([])
		expect(result.current.isSheetOpen).toBe(true)
		expect(result.current.isVisible).toBe(true)
	})
	it('drops the button with the status in one render, before the refetch is done', async () => {
		const refetches: (() => void)[] = []
		const queryClient = new QueryClient()
		vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					refetches.push(resolve)
				}),
		)
		// the entries stay canRemember: the refetch has not brought the new flag yet
		const { result } = renderHookWithProviders(
			() => ({ action: useRememberAction(ONE), isOverlayOpen: useIsOverlayOpen() }),
			{ queryClient },
		)

		let submitted: Promise<void> = Promise.resolve()
		act(() => {
			submitted = result.current.action.submit(['a'])
		})
		await waitFor(() => {
			expect(result.current.action.rememberedNames).toEqual(['Кабаноси'])
		})
		expect(result.current.action.rememberable).toEqual([])
		// the feed is still held while the refetch runs
		expect(result.current.isOverlayOpen).toBe(true)

		await act(async () => {
			refetches.forEach((finish) => {
				finish()
			})
			await submitted
		})
		expect(result.current.isOverlayOpen).toBe(false)
		expect(result.current.action.isVisible).toBe(true)
	})
})
