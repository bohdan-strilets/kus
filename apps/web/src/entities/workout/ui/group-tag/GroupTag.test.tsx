// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { GroupDot } from '../group-dot'
import { GroupTag } from './GroupTag'

afterEach(cleanup)

describe('GroupTag and GroupDot', () => {
	it('shows the group name with a detail', () => {
		const { container } = render(<GroupTag group="BACK" detail="6" />)

		expect(container.textContent).toBe('Спина6')
	})

	it('shows cardio with minutes', () => {
		const { container } = render(<GroupTag group="CARDIO" detail="25 хв" />)

		expect(container.textContent).toBe('Кардіо25 хв')
	})

	it('hides the dot from screen readers', () => {
		const { container } = render(<GroupDot group="LEGS" />)

		expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
	})
})
