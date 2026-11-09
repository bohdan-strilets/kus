// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeWorkout, renderWithProviders } from '@/shared/testing'

import { SessionSummaryCard } from './SessionSummaryCard'

const LONG_NAME = 'Груди, плечі й трицепс — важкий день'

afterEach(cleanup)

describe('SessionSummaryCard name', () => {
	it('titles a named training with the name, clamped to two lines', () => {
		renderWithProviders(
			<SessionSummaryCard
				workout={makeWorkout({ place: 'GYM', templateName: LONG_NAME })}
				hasTail={false}
			/>,
		)

		expect(screen.getByTitle(LONG_NAME).className).toContain('line-clamp-2')
	})

	it('falls back to the place without a name', () => {
		renderWithProviders(
			<SessionSummaryCard
				workout={makeWorkout({ place: 'GYM', templateName: null })}
				hasTail={false}
			/>,
		)

		expect(screen.getByTitle('Зал')).toBeTruthy()
	})
})
