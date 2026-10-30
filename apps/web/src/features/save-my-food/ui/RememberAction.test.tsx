// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import type { RememberActionState } from '../model/use-remember-action'
import { RememberAction } from './RememberAction'

const entry = (id: string) =>
	({ id, name: id }) as unknown as RememberActionState['rememberable'][0]

const makeAction = (overrides: Partial<RememberActionState>): RememberActionState => ({
	rememberable: [],
	rememberedNames: [],
	isSheetOpen: false,
	isPending: false,
	isVisible: true,
	setIsSheetOpen: vi.fn(),
	press: vi.fn(),
	submit: vi.fn(),
	...overrides,
})

afterEach(cleanup)

describe('RememberAction', () => {
	it('puts the status on its own full-width line above the button after a partial save', () => {
		renderWithProviders(
			<RememberAction
				action={makeAction({ rememberable: [entry('b')], rememberedNames: ['ківі'] })}
			/>,
		)

		const status = screen.getByRole('status')
		expect(status.textContent).toContain('ківі')
		expect(status.className).toContain('basis-full')
		expect(status.className).toContain('order-first')
		expect(screen.getByRole('button', { name: /Запам'ятати/ })).toBeTruthy()
	})

	it('keeps an empty live region that takes no space', () => {
		renderWithProviders(<RememberAction action={makeAction({ rememberable: [entry('a')] })} />)

		const status = screen.getByRole('status')
		expect(status.textContent).toBe('')
		expect(status.className).toContain('sr-only')
		expect(status.className).not.toContain('basis-full')
	})
})
