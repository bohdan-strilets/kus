// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTemplate, renderWithProviders } from '@/shared/testing'

import { buildFormDraft } from '../lib/build-form-draft'
import { createFormExercise } from '../lib/form-exercise-edit'
import type { FormExerciseValue } from '../lib/workout-form.types'
import { ExercisePlanRow } from './ExercisePlanRow'

const NOW = { localDate: '2026-11-02', time: '18:30' }

const addedExercise = (): FormExerciseValue =>
	createFormExercise(
		{ name: 'Тяга', exerciseId: null, kind: 'STRENGTH', muscleGroup: 'BACK', lastSets: null },
		'added',
	)

const plannedExercise = (): FormExerciseValue => {
	const [exercise] = buildFormDraft(makeTemplate(), { now: NOW }).exercises
	return exercise as FormExerciseValue
}

const Harness = ({ initial }: { initial: FormExerciseValue }) => {
	const [exercise, setExercise] = useState(initial)
	return <ExercisePlanRow exercise={exercise} onChange={setExercise} />
}

afterEach(cleanup)

describe('ExercisePlanRow: an ADDED exercise (no plan)', () => {
	it('has no «Як за планом» and a neutral background, not the «змінено» one', () => {
		const { container } = renderWithProviders(<Harness initial={addedExercise()} />)

		expect(screen.queryByRole('button', { name: 'Як за планом' })).toBeNull()
		const card = container.firstElementChild as HTMLElement
		expect(card.className).not.toContain('bg-muscle-arms-bg')
		expect(card.className).toContain('bg-surface/85')
	})

	it('opens, offers «Не робили», and «Повернути» brings a skipped one back', () => {
		renderWithProviders(<Harness initial={addedExercise()} />)

		fireEvent.click(screen.getByRole('button', { name: /^Тяга/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Не робили' }))

		expect(screen.getByText('не робили')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Як за планом' })).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Повернути' }))

		expect(screen.queryByText('не робили')).toBeNull()
		expect(screen.queryByRole('button', { name: 'Повернути' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Як за планом' })).toBeNull()
	})

	it('editing an added exercise never makes it «змінено»', () => {
		const { container } = renderWithProviders(<Harness initial={addedExercise()} />)
		fireEvent.click(screen.getByRole('button', { name: /^Тяга/ }))

		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))

		expect((container.firstElementChild as HTMLElement).className).not.toContain(
			'bg-muscle-arms-bg',
		)
		expect(screen.queryByText(/^Змінено:/)).toBeNull()
	})
})

describe('ExercisePlanRow: subtitle and changed set', () => {
	it('an added exercise ends its subtitle with « · додано»', () => {
		renderWithProviders(<Harness initial={addedExercise()} />)

		const subtitle = screen.getByRole('button', { name: /^Тяга/ }).textContent
		expect(subtitle.endsWith(' · додано')).toBe(true)
	})

	it('an exercise of the plan has no «додано»', () => {
		renderWithProviders(<Harness initial={plannedExercise()} />)

		expect(screen.queryByText(/додано/)).toBeNull()
	})

	it('a changed set row is highlighted and says «змінено»', () => {
		renderWithProviders(<Harness initial={plannedExercise()} />)
		fireEvent.click(screen.getByRole('button', { name: /^Жим лежачи/ }))
		fireEvent.click(screen.getByRole('button', { name: '+ Підхід' }))

		const label = screen.getByText('змінено')
		expect(label).toBeTruthy()
		const row = label.parentElement as HTMLElement
		expect(row.className).toContain('bg-muscle-arms-bg')
	})
})

describe('ExercisePlanRow: 44 px tap targets', () => {
	it('the exercise name control and «Повернути» carry min-h-tap', () => {
		renderWithProviders(<Harness initial={{ ...plannedExercise(), isSkipped: true }} />)

		expect(screen.getByRole('button', { name: /^Жим лежачи/ }).className).toContain('min-h-tap')
		expect(screen.getByRole('button', { name: 'Повернути' }).className).toContain('min-h-tap')
	})

	it('an added exercise: the name control has min-h-tap too', () => {
		renderWithProviders(<Harness initial={addedExercise()} />)

		expect(screen.getByRole('button', { name: /^Тяга/ }).className).toContain('min-h-tap')
	})
})
