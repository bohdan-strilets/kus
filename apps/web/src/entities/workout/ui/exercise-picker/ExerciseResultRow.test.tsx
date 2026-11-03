// @vitest-environment jsdom
import type { ExerciseDictionaryItem } from '@kus/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { ExerciseResultRow } from './ExerciseResultRow'

const makeExercise = (overrides: Partial<ExerciseDictionaryItem>): ExerciseDictionaryItem => ({
	id: '0199b3a4-0000-7000-8000-000000000f01',
	name: 'Біг',
	kind: 'CARDIO',
	muscleGroup: null,
	lastSets: null,
	lastCardio: null,
	...overrides,
})

const renderRow = (overrides: Partial<ExerciseDictionaryItem>) =>
	render(<ExerciseResultRow exercise={makeExercise(overrides)} onAdd={() => undefined} />)

describe('ExerciseResultRow', () => {
	afterEach(cleanup)

	it('shows the last cardio result: minutes, distance, or both', () => {
		renderRow({ lastCardio: { durationMin: 20, distanceM: 3000 } })
		expect(screen.getByText('20 хв · 3,0 км')).toBeTruthy()
		expect(screen.queryByText('ще не було')).toBeNull()
		cleanup()

		renderRow({ lastCardio: { durationMin: 10, distanceM: null } })
		expect(screen.getByText('10 хв')).toBeTruthy()
		cleanup()

		renderRow({ lastCardio: { durationMin: null, distanceM: 2000 } })
		expect(screen.getByText('2,0 км')).toBeTruthy()
	})

	it('says «ще не було» for cardio that never happened', () => {
		renderRow({ lastCardio: null })

		expect(screen.getByText('ще не було')).toBeTruthy()
	})

	it('shows a neutral dot for a strength exercise without a muscle group', () => {
		const { container } = renderRow({ kind: 'STRENGTH', muscleGroup: null })

		expect(container.querySelector('span[aria-hidden="true"].bg-muted-soft')).not.toBeNull()
	})
})
