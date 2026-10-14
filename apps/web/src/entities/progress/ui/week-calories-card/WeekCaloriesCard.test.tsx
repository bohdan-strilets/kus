// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { makeProgress } from '@/shared/testing'
import { WeekCaloriesCard } from './WeekCaloriesCard'

const { week } = makeProgress()
const TODAY = '2026-10-12'

afterEach(cleanup)

describe('WeekCaloriesCard', () => {
	it('explains the dashed line and the over colour in the legend', () => {
		const { container } = render(<WeekCaloriesCard week={week} today={TODAY} />)

		expect(screen.getByText((text) => text.replace(/\s/g, ' ') === 'ціль 2 200')).toBeTruthy()
		expect(screen.getByText('понад ціль')).toBeTruthy()
		expect(container.querySelector('span.bg-over')).not.toBeNull()
	})

	it('has no legend without a goal', () => {
		render(<WeekCaloriesCard week={{ ...week, goalKcal: null }} today={TODAY} />)

		expect(screen.queryByText('понад ціль')).toBeNull()
	})
})
