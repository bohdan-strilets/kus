// @vitest-environment jsdom
import type { WorkoutResponse } from '@kus/shared'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeExercise, renderWithProviders } from '@/shared/testing'

import { SessionExercise } from './SessionExercise'

afterEach(cleanup)

const cardio = (overrides = {}) =>
	makeExercise({
		id: '0199b3a4-0000-7000-8000-0000000000c1',
		name: 'Бігова доріжка',
		kind: 'CARDIO',
		muscleGroup: null,
		durationMin: 15,
		distanceM: 2100,
		sets: [],
		...overrides,
	})

const renderExercise = (exercise = cardio(), workoutKcal?: WorkoutResponse['kcal']) =>
	renderWithProviders(
		<ul>
			<SessionExercise exercise={exercise} workoutKcal={workoutKcal} />
		</ul>,
	)

describe('SessionExercise kcal row', () => {
	it('a cardio number from a device reads «з табло» and does not touch the goal', () => {
		renderExercise(cardio({ kcalBurned: 180, kcalSource: 'DEVICE' }))

		expect(screen.getByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
	})

	it('a number the person told reads «зі слів»', () => {
		renderExercise(cardio({ kcalBurned: 380, kcalSource: 'MANUAL' }))

		expect(screen.getByText('380 ккал · зі слів · на ціль не впливає')).toBeTruthy()
	})

	it('any other source reads «зі слів», never an invented label', () => {
		renderExercise(cardio({ kcalBurned: 250, kcalSource: 'AI_ESTIMATE' }))

		expect(screen.getByText('250 ккал · зі слів · на ціль не впливає')).toBeTruthy()
	})

	it('a number without a source reads «зі слів»', () => {
		renderExercise(cardio({ kcalBurned: 250, kcalSource: null }))

		expect(screen.getByText('250 ккал · зі слів · на ціль не впливає')).toBeTruthy()
	})

	it('formats a big number with a thousands separator', () => {
		renderExercise(cardio({ kcalBurned: 1200, kcalSource: 'DEVICE' }))

		expect(screen.getByText(/^1\s?200 ккал · з табло/)).toBeTruthy()
	})

	it('shows nothing for a cardio exercise without a number', () => {
		renderExercise(cardio())

		expect(screen.getByText('Бігова доріжка')).toBeTruthy()
		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('shows nothing for a strength exercise, even if a number is there', () => {
		renderExercise(makeExercise({ kcalBurned: 300, kcalSource: 'MANUAL' }))

		expect(screen.getByText('Жим лежачи')).toBeTruthy()
		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('a zero is a number, not «none»', () => {
		renderExercise(cardio({ kcalBurned: 0, kcalSource: 'MANUAL' }))

		expect(screen.getByText('0 ккал · зі слів · на ціль не впливає')).toBeTruthy()
	})
})

describe('SessionExercise kcal row against the header number', () => {
	const device = cardio({ kcalBurned: 180, kcalSource: 'DEVICE' })

	it('is hidden when the header names the same number (said once, up there)', () => {
		renderExercise(device, { value: 180, source: 'DEVICE' })

		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('is hidden for a number told in words as well', () => {
		renderExercise(cardio({ kcalBurned: 380, kcalSource: 'MANUAL' }), {
			value: 380,
			source: 'MANUAL',
		})

		expect(screen.queryByText(/ккал/)).toBeNull()
	})

	it('is shown when the header is an estimate, even with the same value', () => {
		renderExercise(device, { value: 180, source: 'ESTIMATE' })

		expect(screen.getByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
	})

	it('is shown when the header is another number (several contributors)', () => {
		renderExercise(device, { value: 380, source: 'MANUAL' })

		expect(screen.getByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
	})

	it('is shown with no header number at all', () => {
		renderExercise(device, null)

		expect(screen.getByText('180 ккал · з табло · на ціль не впливає')).toBeTruthy()
	})
})
