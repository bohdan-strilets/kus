// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTemplate, renderWithProviders } from '@/shared/testing'

import { buildFormDraft } from '../lib/build-form-draft'
import { createFormExercise } from '../lib/form-exercise-edit'
import type { FormExerciseValue } from '../lib/workout-form.types'
import { ExercisePlanRow } from './ExercisePlanRow'

const NOW = { localDate: '2026-11-02', time: '18:30' }

const addedExercise = (): FormExerciseValue => ({
	...createFormExercise(
		{ name: 'Тяга', exerciseId: null, kind: 'STRENGTH', muscleGroup: 'BACK', lastSets: null },
		'added',
	),
	sets: [1, 2, 3].map((reps) => ({
		rowKey: `set-${reps}`,
		planKey: null,
		reps,
		weightKg: 40,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
	})),
})

const plannedExercise = (): FormExerciseValue => {
	const [exercise] = buildFormDraft(makeTemplate(), { now: NOW }).exercises
	return exercise as FormExerciseValue
}

interface HarnessProps {
	initial: FormExerciseValue
	onRemove?: (row: HTMLElement | null) => void
	onState?: (exercise: FormExerciseValue) => void
}

const Harness = ({ initial, onRemove = () => undefined, onState }: HarnessProps) => {
	const [exercise, setExercise] = useState(initial)
	onState?.(exercise)
	return <ExercisePlanRow exercise={exercise} onChange={setExercise} onRemove={onRemove} />
}

const openCard = (name: RegExp): void => {
	fireEvent.click(screen.getByRole('button', { name }))
}

afterEach(cleanup)

describe('ExercisePlanRow: removing an exercise', () => {
	it('the basket of an ADDED exercise calls onRemove with its swipe row, once', () => {
		const onRemove = vi.fn()
		renderWithProviders(<Harness initial={addedExercise()} onRemove={onRemove} />)
		openCard(/^Тяга/)

		fireEvent.click(
			screen.getAllByRole('button', { name: 'Видалити вправу «Тяга»' })[0] as HTMLElement,
		)

		expect(onRemove).toHaveBeenCalledTimes(1)
		const row = onRemove.mock.calls[0]?.[0] as HTMLElement | null
		expect(row?.hasAttribute('data-swipe-row')).toBe(true)
	})

	it('an exercise of the plan has «Не робили» and no basket', () => {
		const onRemove = vi.fn()
		renderWithProviders(<Harness initial={plannedExercise()} onRemove={onRemove} />)
		openCard(/^Жим лежачи/)

		expect(screen.getByRole('button', { name: 'Не робили' })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /^Видалити вправу/ })).toBeNull()
		expect(onRemove).not.toHaveBeenCalled()
	})

	it('«Не робили» skips instead of removing: onRemove is not called', () => {
		const onRemove = vi.fn()
		renderWithProviders(<Harness initial={plannedExercise()} onRemove={onRemove} />)
		openCard(/^Жим лежачи/)

		fireEvent.click(screen.getByRole('button', { name: 'Не робили' }))

		expect(screen.getByText('не робили')).toBeTruthy()
		expect(onRemove).not.toHaveBeenCalled()
	})

	it('a skipped exercise has no swipe frame (nothing to swipe, it only comes back)', () => {
		const { container } = renderWithProviders(
			<Harness initial={{ ...plannedExercise(), isSkipped: true }} />,
		)

		expect(container.querySelector('[data-swipe-row]')).toBeNull()
		expect(screen.getByRole('button', { name: 'Повернути' })).toBeTruthy()
	})

	it('the swipe action of a planned exercise skips it (the neutral variant), not deletes', () => {
		renderWithProviders(<Harness initial={plannedExercise()} />)

		expect(screen.queryByRole('button', { name: /^Видалити вправу/, hidden: true })).toBeNull()
		fireEvent.click(
			screen.getByRole('button', { name: 'Не робили вправу «Жим лежачи»', hidden: true }),
		)

		expect(screen.getByText('не робили')).toBeTruthy()
	})
})

describe('ExercisePlanRow: removing a set', () => {
	it('the basket of the open set takes it out, the toast says which, «Скасувати» returns it', async () => {
		let latest: FormExerciseValue = addedExercise()
		renderWithProviders(
			<Harness
				initial={addedExercise()}
				onState={(exercise) => {
					latest = exercise
				}}
			/>,
		)
		openCard(/^Тяга/)
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 2, змінити' }))

		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 2' }))

		expect(latest.sets.map(({ reps }) => reps)).toEqual([1, 3])
		expect(await screen.findByText('Підхід 2 видалено')).toBeTruthy()

		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(latest.sets.map(({ reps }) => reps)).toEqual([1, 2, 3])
		})
	})

	it('undo keeps an edit made to another set while the toast hung', async () => {
		let latest: FormExerciseValue = addedExercise()
		renderWithProviders(
			<Harness
				initial={addedExercise()}
				onState={(exercise) => {
					latest = exercise
				}}
			/>,
		)
		openCard(/^Тяга/)
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 3, змінити' }))
		fireEvent.click(screen.getByRole('button', { name: 'Видалити підхід 3' }))
		const undo = await screen.findByRole('button', { name: 'Скасувати' })
		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))
		const countWithAdded = latest.sets.length

		fireEvent.click(undo)

		await waitFor(() => {
			expect(latest.sets).toHaveLength(countWithAdded + 1)
		})
		expect(latest.sets.slice(0, 3).map(({ reps }) => reps)).toEqual([1, 2, 3])
	})

	it('a warm-up has its own toast text', async () => {
		const exercise = addedExercise()
		const [first, ...rest] = exercise.sets
		if (!first) throw new Error('the added exercise has no sets')
		exercise.sets = [{ ...first, isWarmup: true }, ...rest]
		renderWithProviders(<Harness initial={exercise} />)
		openCard(/^Тяга/)
		fireEvent.click(screen.getByRole('button', { name: 'Підхід 1, змінити' }))

		fireEvent.click(screen.getByRole('button', { name: 'Видалити розминку' }))

		expect(await screen.findByText('Розминку видалено')).toBeTruthy()
	})
})
