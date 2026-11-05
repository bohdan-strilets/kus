// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StatTile } from './StatTile'

afterEach(cleanup)

describe('StatTile', () => {
	it('shows the note and the extra note under the value', () => {
		render(
			<StatTile
				label="Разом"
				value="2 год"
				note="52 хв за раз"
				extraNote="1 тренування без часу"
			/>,
		)

		expect(screen.getByText('52 хв за раз')).toBeTruthy()
		expect(screen.getByText('1 тренування без часу')).toBeTruthy()
	})

	it('has no extra line without extraNote', () => {
		render(<StatTile label="Разом" value="2 год" note="52 хв за раз" />)

		expect(screen.queryByText('1 тренування без часу')).toBeNull()
		expect(screen.getByText('52 хв за раз')).toBeTruthy()
	})
})
