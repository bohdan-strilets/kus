// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTemplate, renderWithProviders } from '@/shared/testing'

import { ProgramModeSection } from './ProgramModeSection'

const NEXT = 'Наступне — те, що йде після останнього зробленого.'

afterEach(cleanup)

describe('ProgramModeSection', () => {
	it('shows custom names once on a truncated line with the full sequence in the title', () => {
		renderWithProviders(
			<ProgramModeSection
				mode="ROTATE"
				templates={[
					makeTemplate({ name: 'Груди, плечі й трицепс — важкий день', position: 0 }),
					makeTemplate({ name: 'Спина і біцепс', position: 1 }),
				]}
				onChange={vi.fn()}
			/>,
		)

		const sequence = 'Груди, плечі й трицепс — важкий день → Спина і біцепс → …'
		const line = screen.getByText(sequence)
		expect(line.className).toContain('truncate')
		expect(line.getAttribute('title')).toBe(sequence)
		expect(screen.getByText(NEXT)).toBeTruthy()
	})

	it('keeps the default names in one line with the sentence', () => {
		renderWithProviders(
			<ProgramModeSection
				mode="ROTATE"
				templates={[
					makeTemplate({ name: 'Тренування А', position: 0 }),
					makeTemplate({ name: 'Тренування Б', position: 1 }),
				]}
				onChange={vi.fn()}
			/>,
		)

		const line = screen.getByText(`А → Б → А… ${NEXT}`)
		expect(line.className).not.toContain('truncate')
	})
})
