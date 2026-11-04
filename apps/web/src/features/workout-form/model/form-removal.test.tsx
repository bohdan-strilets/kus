// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTemplate, renderHookWithProviders } from '@/shared/testing'

import { createFormExercise, removeFormSet, restoreFormSet } from '../lib/form-exercise-edit'
import type { FormExerciseValue, FormSetValue } from '../lib/workout-form.types'
import { useFormSetRemoval } from './use-form-set-removal'
import { useWorkoutForm } from './use-workout-form'

const NOW = { localDate: '2026-11-02', time: '18:30' }

const formSet = (reps: number, overrides: Partial<FormSetValue> = {}): FormSetValue => ({
	reps,
	weightKg: 50,
	durationSec: null,
	distanceM: null,
	isWarmup: false,
	...overrides,
})

const addedExercise = (key: string, name: string): FormExerciseValue => ({
	...createFormExercise(
		{ name, exerciseId: null, kind: 'STRENGTH', muscleGroup: 'BACK', lastSets: null },
		key,
	),
	sets: [formSet(1), formSet(2), formSet(3)],
})

const repsOf = (exercise: FormExerciseValue): (number | null)[] =>
	exercise.sets.map(({ reps }) => reps)

afterEach(cleanup)

describe('removeFormSet / restoreFormSet', () => {
	it('removes the set and restores it on the same place', () => {
		const exercise = addedExercise('a', 'Тяга')
		const removed = exercise.sets[1] as FormSetValue

		const without = removeFormSet(exercise, 1)
		expect(repsOf(without)).toEqual([1, 3])

		const back = restoreFormSet(without, 1, removed)
		expect(repsOf(back)).toEqual([1, 2, 3])
		expect(back.sets[1]).toBe(removed)
	})

	it('keeps the other fields and does not mutate the input', () => {
		const exercise = addedExercise('a', 'Тяга')
		const without = removeFormSet(exercise, 0)
		expect(without.key).toBe('a')
		expect(without.name).toBe('Тяга')
		expect(repsOf(exercise)).toEqual([1, 2, 3])
	})

	it('a warm-up keeps its flag when restored', () => {
		const warm = formSet(5, { isWarmup: true })
		const exercise = { ...addedExercise('a', 'Тяга'), sets: [warm, formSet(1)] }

		const back = restoreFormSet(removeFormSet(exercise, 0), 0, warm)

		expect(back.sets[0]?.isWarmup).toBe(true)
	})

	it('clamps the index when sets went meanwhile', () => {
		const exercise = { ...addedExercise('a', 'Тяга'), sets: [formSet(1)] }
		expect(repsOf(restoreFormSet(exercise, 6, formSet(9)))).toEqual([1, 9])
	})

	it('an index with no set removes nothing; the last set can go (the schema rejects an empty exercise later)', () => {
		const exercise = addedExercise('a', 'Тяга')
		expect(repsOf(removeFormSet(exercise, 8))).toEqual([1, 2, 3])
		const single = { ...exercise, sets: [formSet(1)] }
		expect(removeFormSet(single, 0).sets).toEqual([])
	})
})

describe('useWorkoutForm.removeExercise', () => {
	const renderForm = () => {
		const view = renderHookWithProviders(() =>
			useWorkoutForm({ template: makeTemplate(), now: NOW }),
		)
		act(() => {
			view.result.current.exercises.append(addedExercise('added-1', 'Тяга'))
			view.result.current.exercises.append(addedExercise('added-2', 'Присід'))
		})
		return view
	}

	const namesOf = (names: { name: string }[]): string[] => names.map(({ name }) => name)

	it('takes the exercise out and shows «Вправу видалено»', async () => {
		const { result } = renderForm()
		const before = result.current.form.getValues('exercises').length

		act(() => {
			result.current.removeExercise(before - 2)
		})

		const names = namesOf(result.current.form.getValues('exercises'))
		expect(names).not.toContain('Тяга')
		expect(names).toContain('Присід')
		expect(names).toHaveLength(before - 1)
		expect(await screen.findByText('Вправу видалено')).toBeTruthy()
	})

	it('«Скасувати» returns the exercise on its old place, with its sets and key', async () => {
		const { result } = renderForm()
		const orderBefore = namesOf(result.current.form.getValues('exercises'))
		const index = orderBefore.indexOf('Тяга')

		act(() => {
			result.current.removeExercise(index)
		})
		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(namesOf(result.current.form.getValues('exercises'))).toEqual(orderBefore)
		})
		const restored = result.current.form.getValues('exercises')[index] as FormExerciseValue
		expect(restored.key).toBe('added-1')
		expect(repsOf(restored)).toEqual([1, 2, 3])
	})

	it('an index with no exercise does nothing: no toast, the list is the same', () => {
		const { result } = renderForm()
		const before = result.current.form.getValues('exercises').length

		act(() => {
			result.current.removeExercise(before + 3)
		})

		expect(result.current.form.getValues('exercises')).toHaveLength(before)
		expect(screen.queryByText('Вправу видалено')).toBeNull()
	})

	it('removing from the end and undoing puts it back at the end', async () => {
		const { result } = renderForm()
		const orderBefore = namesOf(result.current.form.getValues('exercises'))
		const last = orderBefore.length - 1

		act(() => {
			result.current.removeExercise(last)
		})
		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => {
			expect(namesOf(result.current.form.getValues('exercises'))).toEqual(orderBefore)
		})
	})

	it('undo after other exercises were removed meanwhile stays inside the list', async () => {
		const { result } = renderForm()
		const count = result.current.form.getValues('exercises').length

		act(() => {
			result.current.removeExercise(count - 1)
		})
		const undo = await screen.findByRole('button', { name: 'Скасувати' })
		act(() => {
			result.current.exercises.remove(0)
		})
		fireEvent.click(undo)

		await waitFor(() => {
			expect(result.current.form.getValues('exercises')).toHaveLength(count - 1)
		})
		expect(namesOf(result.current.form.getValues('exercises')).at(-1)).toBe('Присід')
	})
})

describe('useFormSetRemoval', () => {
	it('a second press of «Скасувати» does not insert the set twice', async () => {
		const { result } = renderHookWithProviders(() => {
			const [exercise, setExercise] = useState(addedExercise('a', 'Тяга'))
			return { exercise, remove: useFormSetRemoval(exercise, setExercise) }
		})
		act(() => {
			result.current.remove(1)
		})
		expect(repsOf(result.current.exercise)).toEqual([1, 3])
		const undo = await screen.findByRole('button', { name: 'Скасувати' })

		fireEvent.click(undo)
		fireEvent.click(undo)

		await waitFor(() => {
			expect(repsOf(result.current.exercise)).toEqual([1, 2, 3])
		})
	})
})
