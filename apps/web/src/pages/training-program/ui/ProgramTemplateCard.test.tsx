// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTemplate, renderWithProviders } from '@/shared/testing'

import { ProgramTemplateCard } from './ProgramTemplateCard'

const LONG_NAME = 'Груди, плечі й трицепс — важкий день'

afterEach(cleanup)

describe('ProgramTemplateCard', () => {
	it('puts the full name into the label and the title of its link', () => {
		renderWithProviders(
			<ProgramTemplateCard
				template={makeTemplate({ name: LONG_NAME })}
				mode="ROTATE"
				isNext={false}
				isPinned={false}
				isBusy={false}
				onPin={vi.fn()}
				onToggleWeekday={vi.fn()}
			/>,
		)

		expect(screen.getByRole('link', { name: LONG_NAME }).getAttribute('title')).toBe(LONG_NAME)
	})
})
