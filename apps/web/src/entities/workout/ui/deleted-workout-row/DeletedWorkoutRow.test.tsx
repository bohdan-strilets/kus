// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'
import { makeWorkout } from '@/shared/testing'

import { DeletedWorkoutRow } from './DeletedWorkoutRow'

afterEach(cleanup)

describe('DeletedWorkoutRow', () => {
	it('says which day the deleted training was on, like the mockup', () => {
		render(<DeletedWorkoutRow workout={makeWorkout({ isDeleted: true })} />)

		expect(screen.getByText('Тренування 26.10 видалено.')).toBeTruthy()
	})
})
