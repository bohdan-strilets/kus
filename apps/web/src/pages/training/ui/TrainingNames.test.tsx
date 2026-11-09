// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTemplate, makeWorkout, renderWithProviders } from '@/shared/testing'

import { getJournalRow } from '../lib/get-journal-row'
import { NextWorkoutCard } from './NextWorkoutCard'
import { TrainingRow } from './TrainingRow'

const LONG_NAME = 'Груди, плечі й трицепс — важкий день'

afterEach(cleanup)

describe('NextWorkoutCard', () => {
	it('keeps the full name in the label and the title, and clamps the view to two lines', () => {
		renderWithProviders(<NextWorkoutCard template={makeTemplate({ name: LONG_NAME })} />)

		const link = screen.getByRole('link', { name: new RegExp(`^${LONG_NAME} · `) })

		expect(link.getAttribute('title')).toBe(LONG_NAME)
		expect(link.querySelector('.line-clamp-2')?.textContent).toBe(LONG_NAME)
		expect(link.textContent).not.toContain('…')
	})

	it('shows a default name as it is', () => {
		renderWithProviders(<NextWorkoutCard template={makeTemplate({ name: 'Тренування Б' })} />)

		expect(screen.getByRole('link', { name: /^Тренування Б · / }).getAttribute('title')).toBe(
			'Тренування Б',
		)
	})
})

describe('TrainingRow', () => {
	const t = ((key: string, options?: Record<string, string>) =>
		options ? `${key}:${Object.values(options).join('|')}` : key) as never

	it('truncates the template name, not the title, and keeps the full name in title and label', () => {
		const workout = makeWorkout({ place: 'GYM', templateName: LONG_NAME, durationMin: 62 })
		renderWithProviders(<TrainingRow row={getJournalRow(workout, t)} isDateShown />)

		const link = screen.getByRole('link')

		expect(link.getAttribute('aria-label')).toContain(LONG_NAME)
		expect(link.querySelector(`[title="${LONG_NAME}"]`)?.className).toContain('truncate')
	})

	it('does not break without a template name', () => {
		const workout = makeWorkout({ place: 'GYM', templateName: null, durationMin: 62 })
		renderWithProviders(<TrainingRow row={getJournalRow(workout, t)} isDateShown />)

		expect(screen.getByRole('link').getAttribute('aria-label')).not.toContain(LONG_NAME)
	})
})
