// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { SessionTiles } from './SessionTiles'

afterEach(cleanup)

describe('SessionTiles', () => {
	it('shows «Вправ» and «Підходів» as two separate tiles', () => {
		render(
			<SessionTiles duration={null} strength={{ exerciseCount: 4, setCount: 13 }} cardio={null} />,
		)

		const exercises = screen.getByText('Вправ')
		const sets = screen.getByText('Підходів')
		expect(exercises.parentElement).not.toBe(sets.parentElement)
		expect(exercises.parentElement?.textContent).toContain('4')
		expect(sets.parentElement?.textContent).toContain('13')
	})

	it('adds the duration tile and no strength tiles without strength', () => {
		render(<SessionTiles duration="62 хв" strength={null} cardio={null} />)

		expect(screen.getByText('Тривалість')).toBeTruthy()
		expect(screen.getByText('62 хв')).toBeTruthy()
		expect(screen.queryByText('Вправ')).toBeNull()
		expect(screen.queryByText('Підходів')).toBeNull()
	})

	it('renders nothing when there is nothing to show', () => {
		const { container } = render(<SessionTiles duration={null} strength={null} cardio={null} />)

		expect(container.firstChild).toBeNull()
	})
})
