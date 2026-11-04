// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { SetRow, type SetRowProps } from './SetRow'

afterEach(cleanup)

const renderRow = (patch: Partial<SetRowProps> = {}) =>
	renderWithProviders(
		<SetRow
			label="1"
			ariaLabel="Підхід 1, змінити"
			reps={8}
			weightKg={50}
			hasWeight
			isWarmup={false}
			isDone={false}
			{...patch}
		/>,
	)

const getRoot = (container: HTMLElement): HTMLElement => container.firstElementChild as HTMLElement

describe('SetRow isChanged', () => {
	it('highlights a changed row with the «змінено» background', () => {
		const { container } = renderRow({ isChanged: true })

		expect(getRoot(container).className).toContain('bg-muscle-arms-bg')
		expect(getRoot(container).className).not.toContain('bg-field')
	})

	it('keeps the neutral background without the prop', () => {
		const { container } = renderRow()

		expect(getRoot(container).className).toContain('bg-field')
		expect(getRoot(container).className).not.toContain('bg-muscle-arms-bg')
	})

	it('a done row stays green even when changed', () => {
		const { container } = renderRow({ isChanged: true, isDone: true })

		expect(getRoot(container).className).toContain('bg-success-soft')
		expect(getRoot(container).className).not.toContain('bg-muscle-arms-bg')
	})

	it('still renders its numbers', () => {
		renderRow({ isChanged: true })

		expect(screen.getByText('8')).toBeTruthy()
	})
})
