// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { MacroTiles } from './MacroTiles'

/** The value line is «118» + a nested span, so the whole line is matched by its text content. */
const getValueLine = (text: RegExp): HTMLElement =>
	screen.getByText((_, element) => element?.tagName === 'SPAN' && text.test(element.textContent))

afterEach(cleanup)

describe('MacroTiles compact', () => {
	it('with a goal: «118/140»', () => {
		renderWithProviders(
			<MacroTiles
				variant="compact"
				macros={{
					protein: { value: 118, goal: 140 },
					carbs: { value: 236, goal: 230 },
					fat: { value: 84, goal: 80 },
				}}
			/>,
		)

		expect(getValueLine(/^118\/140$/)).toBeTruthy()
	})

	it('without a goal the amount keeps its unit: «118 г»', () => {
		renderWithProviders(
			<MacroTiles
				variant="compact"
				macros={{
					protein: { value: 118, goal: null },
					carbs: { value: 236, goal: null },
					fat: { value: 70, goal: null },
				}}
			/>,
		)

		expect(getValueLine(/^118\sг$/)).toBeTruthy()
		expect(getValueLine(/^236\sг$/)).toBeTruthy()
		expect(getValueLine(/^70\sг$/)).toBeTruthy()
	})
})
