// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { EmptyDayKind } from '../lib/get-empty-kind'
import { TodayEmpty } from './TodayEmpty'

afterEach(cleanup)

const FRIDAY = '2026-10-16'

const renderEmpty = (kind: EmptyDayKind, onAction = vi.fn()) => {
	renderWithProviders(<TodayEmpty kind={kind} localDate={FRIDAY} onAction={onAction} />)
	return onAction
}

describe('TodayEmpty', () => {
	it('tells tomorrow how to write ahead', () => {
		renderEmpty('tomorrow')
		expect(screen.getByText('На завтра ще нічого не записано')).toBeTruthy()
		expect(screen.getByText(/на завтра: …/)).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Написати в чат' })).toBeTruthy()
	})

	it('invites a recent day to be filled in, naming its weekday', () => {
		renderEmpty('recent')
		expect(screen.getByText('Цього дня нічого не записано')).toBeTruthy()
		expect(screen.getByText(/у п'ятницю на обід борщ/)).toBeTruthy()
		expect(screen.getByText(/до 3 днів назад/)).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Написати в чат' })).toBeTruthy()
	})

	it('explains the limit on an old day and leads back to today', async () => {
		const onAction = renderEmpty('old')
		expect(screen.getByText(/лише до 3 днів назад/)).toBeTruthy()
		await userEvent.click(screen.getByRole('button', { name: 'До сьогодні' }))
		expect(onAction).toHaveBeenCalledOnce()
	})
})
