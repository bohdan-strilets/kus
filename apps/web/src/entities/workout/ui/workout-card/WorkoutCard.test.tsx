// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeExercise, makeWorkout, renderWithProviders } from '@/shared/testing'

import { WorkoutCard } from './WorkoutCard'

afterEach(cleanup)

describe('WorkoutCard', () => {
	it('shows the kind, the duration and a strength row like the mockup', () => {
		renderWithProviders(<WorkoutCard workout={makeWorkout()} />)

		expect(screen.getByText(/^Зал/)).toBeTruthy()
		expect(screen.getByText('55 хв')).toBeTruthy()
		expect(screen.getByText('Жим лежачи')).toBeTruthy()
		expect(screen.getByText('80 кг · 3×8')).toBeTruthy()
	})

	it('shows a cardio row with its time and distance next to a strength one', () => {
		renderWithProviders(
			<WorkoutCard
				workout={makeWorkout({
					exercises: [
						makeExercise(),
						makeExercise({
							id: '0199b3a4-0000-7000-8000-0000000000e2',
							name: 'Бігова доріжка',
							kind: 'CARDIO',
							sets: [],
							durationMin: 20,
							distanceM: 3000,
						}),
					],
				})}
			/>,
		)

		expect(screen.getByText('Бігова доріжка')).toBeTruthy()
		expect(screen.getByText('20 хв · 3,0 км')).toBeTruthy()
	})

	it('has the kcal line only for a named number', () => {
		const { rerender } = renderWithProviders(
			<WorkoutCard workout={makeWorkout({ kcalBurned: 320, kcalSource: 'DEVICE' })} />,
		)
		expect(screen.getByText('320 ккал · з табло · на ціль не впливає')).toBeTruthy()

		rerender(<WorkoutCard workout={makeWorkout()} />)
		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('marks an edited workout and a record, and has no buttons', () => {
		renderWithProviders(
			<WorkoutCard
				workout={makeWorkout({ isEdited: true, exercises: [makeExercise({ record: 'WEIGHT' })] })}
			/>,
		)

		expect(screen.getByText(/змінено/)).toBeTruthy()
		expect(screen.getByText('рекорд')).toBeTruthy()
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('survives a workout without a time, a place or a duration', () => {
		renderWithProviders(
			<WorkoutCard workout={makeWorkout({ startedAt: null, place: null, durationMin: null })} />,
		)

		expect(screen.getByText('Тренування')).toBeTruthy()
		expect(screen.queryByText(/ хв$/)).toBeNull()
	})

	it('puts the caller action in the footer, next to the kcal line when there is one', () => {
		const { rerender } = renderWithProviders(
			<WorkoutCard workout={makeWorkout()} footerAction={<button type="button">Дія</button>} />,
		)
		expect(screen.getByRole('button', { name: 'Дія' })).toBeTruthy()
		expect(screen.queryByText(/на ціль не впливає/)).toBeNull()

		rerender(
			<WorkoutCard
				workout={makeWorkout({ kcalBurned: 320, kcalSource: 'DEVICE' })}
				footerAction={<button type="button">Дія</button>}
			/>,
		)
		expect(screen.getByText('320 ккал · з табло · на ціль не впливає')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Дія' })).toBeTruthy()
	})

	it('has no footer without a kcal line and an action', () => {
		const { container } = renderWithProviders(<WorkoutCard workout={makeWorkout()} />)

		expect(container.querySelector('button')).toBeNull()
	})
})
