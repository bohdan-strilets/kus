// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTemplate, renderWithProviders } from '@/shared/testing'

import { buildFormDraft } from '../lib/build-form-draft'
import type { FormExerciseValue } from '../lib/workout-form.types'
import { ExercisePlanRow } from './ExercisePlanRow'

const NOW = { localDate: '2026-11-02', time: '18:30' }
const CHANGE_LINE = 'Змінено: 2 підходи замість 3'

const plannedExercise = (): FormExerciseValue => {
	const [exercise] = buildFormDraft(makeTemplate(), { now: NOW }).exercises
	return exercise as FormExerciseValue
}

const Harness = ({ initial }: { initial: FormExerciseValue }) => {
	const [exercise, setExercise] = useState(initial)
	return <ExercisePlanRow exercise={exercise} onChange={setExercise} onRemove={() => undefined} />
}

const getTitle = (): HTMLElement => screen.getByRole('button', { name: /^Жим лежачи/ })
const getAsPlanned = (): HTMLElement => screen.getByRole('button', { name: 'Як за планом' })

afterEach(cleanup)

describe('ExercisePlanRow: deleting the 1st of 3 sets', () => {
	it('the swipe action updates the subtitle and shows the line; «Скасувати» removes the line', async () => {
		renderWithProviders(<Harness initial={plannedExercise()} />)
		expect(getTitle().textContent).toContain('3 підходи')
		expect(screen.queryByText(/^Змінено:/)).toBeNull()
		fireEvent.click(getTitle())

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 1', hidden: true }))

		expect(screen.getByText(CHANGE_LINE)).toBeTruthy()
		expect(getTitle().textContent).toContain('2 підходи')
		expect(getAsPlanned().getAttribute('aria-pressed')).toBe('false')

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(screen.queryByText(/^Змінено:/)).toBeNull()
		})
		expect(getTitle().textContent).toContain('3 підходи')
		expect(getAsPlanned().getAttribute('aria-pressed')).toBe('true')
	})

	it('the bin of the open set does the same', async () => {
		renderWithProviders(<Harness initial={plannedExercise()} />)
		fireEvent.click(getTitle())
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 1, змінити' }))

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 1' }))

		expect(screen.getByText(CHANGE_LINE)).toBeTruthy()

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(screen.queryByText(CHANGE_LINE)).toBeNull()
		})
	})
})
