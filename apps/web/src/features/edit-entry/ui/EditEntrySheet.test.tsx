// @vitest-environment jsdom
import type { FoodEntryResponse, LoggedMeal } from '@kus/shared'
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatTime } from '@/shared/lib'
import { renderWithProviders } from '@/shared/testing'

import { useEditEntryStore } from '../model/edit-entry-store'
import { EditEntrySheet } from './EditEntrySheet'

const sessionState = vi.hoisted((): { timezone: string | null } => ({ timezone: 'UTC' }))

vi.mock('@/entities/session', () => ({
	useSessionUser: () => (sessionState.timezone ? { timezone: sessionState.timezone } : null),
}))

const NOW = new Date('2026-10-20T12:00:00.000Z')
const ENTRY_ID = '0199b3a4-0000-7000-8000-000000000041'

// only what the sheet, the picker and the form read
const createEntry = (): FoodEntryResponse =>
	({
		id: ENTRY_ID,
		name: 'Борщ',
		kcal: 200,
		protein: 10,
		carbs: 20,
		fat: 5,
		fiber: 2,
		grams: 300,
		quantity: null,
		category: 'SOUP',
		source: 'ESTIMATE',
		isEdited: false,
	}) as unknown as FoodEntryResponse

const createMeal = (eatenAt: string): LoggedMeal =>
	({
		id: '0199b3a4-0000-7000-8000-000000000042',
		type: 'LUNCH',
		localDate: eatenAt.slice(0, 10),
		eatenAt,
		entries: [createEntry()],
	}) as unknown as LoggedMeal

const openSheet = (eatenAt: string, entryId: string | null): void => {
	renderWithProviders(<EditEntrySheet />)
	act(() => {
		useEditEntryStore.getState().open({ meal: createMeal(eatenAt), entryId })
	})
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
	sessionState.timezone = 'UTC'
	useEditEntryStore.setState({ target: null })
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('EditEntrySheet when-label', () => {
	it("today's entry: the time in the subtitle", async () => {
		const eatenAt = '2026-10-20T11:30:00.000Z'
		openSheet(eatenAt, ENTRY_ID)

		expect(await screen.findByText(`Обід · ${formatTime(new Date(eatenAt))}`)).toBeTruthy()
		expect(screen.queryByText(/жовтня/)).toBeNull()
	})

	it("today's entry: the time in the picker", async () => {
		const eatenAt = '2026-10-20T11:30:00.000Z'
		openSheet(eatenAt, null)

		expect(
			await screen.findByText(`${formatTime(new Date(eatenAt))} · обери, що змінити`),
		).toBeTruthy()
	})

	it("yesterday's entry: the day instead of the time in the subtitle", async () => {
		openSheet('2026-10-19T11:30:00.000Z', ENTRY_ID)

		expect(await screen.findByText('Обід · Понеділок, 19 жовтня')).toBeTruthy()
	})

	it("yesterday's entry: the day instead of the time in the picker", async () => {
		openSheet('2026-10-19T11:30:00.000Z', null)

		expect(await screen.findByText('Понеділок, 19 жовтня · обери, що змінити')).toBeTruthy()
	})

	it('the day boundary follows the session timezone', async () => {
		// 23:30 UTC on the 19th is still the 19th in UTC but 12:30 on the 20th in Auckland
		vi.setSystemTime(new Date('2026-10-20T00:30:00.000Z'))
		const eatenAt = '2026-10-19T23:30:00.000Z'

		openSheet(eatenAt, ENTRY_ID)
		expect(await screen.findByText('Обід · Понеділок, 19 жовтня')).toBeTruthy()
		cleanup()

		useEditEntryStore.setState({ target: null })
		sessionState.timezone = 'Pacific/Auckland'
		openSheet(eatenAt, ENTRY_ID)
		expect(await screen.findByText(`Обід · ${formatTime(new Date(eatenAt))}`)).toBeTruthy()
	})

	it('without a session the zone falls back to UTC', async () => {
		sessionState.timezone = null
		openSheet('2026-10-19T11:30:00.000Z', ENTRY_ID)

		expect(await screen.findByText('Обід · Понеділок, 19 жовтня')).toBeTruthy()
	})
})
