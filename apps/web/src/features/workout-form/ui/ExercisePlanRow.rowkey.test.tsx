// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { createFormExercise } from '../lib/form-exercise-edit'
import type { FormExerciseValue } from '../lib/workout-form.types'
import { ExercisePlanRow } from './ExercisePlanRow'

const addedExercise = (): FormExerciseValue => ({
	...createFormExercise(
		{ name: 'Тяга', exerciseId: null, kind: 'STRENGTH', muscleGroup: 'BACK', lastSets: null },
		'added',
	),
	sets: [1, 2, 3].map((reps) => ({
		rowKey: `set-${reps}`,
		reps,
		weightKg: 40,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
	})),
})

const Harness = () => {
	const [exercise, setExercise] = useState(addedExercise())
	return <ExercisePlanRow exercise={exercise} onChange={setExercise} onRemove={() => undefined} />
}

const rowButtons = (): HTMLElement[] =>
	screen.queryAllByRole('button', { name: /^Підхід \d, змінити$/ })

afterEach(cleanup)

describe('ExercisePlanRow: sets are keyed by rowKey', () => {
	it('the other rows keep their DOM nodes after a removal; «Скасувати» brings the row back', async () => {
		renderWithProviders(<Harness />)
		fireEvent.click(screen.getByRole('button', { name: /^Тяга/ }))
		// set 2 is the open block, sets 1 and 3 are rows
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 2, змінити' }))
		const first = screen.getByRole('button', { name: 'Підхід 1, змінити' })
		const third = screen.getByRole('button', { name: 'Підхід 3, змінити' })

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 2' }))

		await waitFor(() => {
			expect(rowButtons()).toHaveLength(2)
		})
		expect(screen.getByRole('button', { name: 'Підхід 1, змінити' })).toBe(first)
		expect(screen.getByRole('button', { name: 'Підхід 2, змінити' })).toBe(third)

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Підхід 3, змінити' })).toBe(third)
		})
		expect(screen.getByRole('button', { name: 'Підхід 1, змінити' })).toBe(first)
		expect(first.isConnected).toBe(true)
	})

	it('after a removal each number is shown once, nothing aria-hidden stays behind', async () => {
		renderWithProviders(<Harness />)
		fireEvent.click(screen.getByRole('button', { name: /^Тяга/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 1, змінити' }))

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 1' }))

		await waitFor(() => {
			expect(rowButtons()).toHaveLength(2)
		})
		await waitFor(() => {
			const hiddenNumbers = Array.from(
				document.querySelectorAll('span[aria-hidden="true"]'),
			).filter((node) => /^\d$/.test(node.textContent))
			expect(hiddenNumbers).toEqual([])
		})
		const visible = Array.from(document.querySelectorAll('span.relative.inline-block > span'))
			.filter((node) => node.getAttribute('aria-hidden') !== 'true')
			.map((node) => node.textContent)
			.filter((text) => text === '1' || text === '2' || text === '3')
		expect(visible).toEqual(['1', '2'])
	})
})
