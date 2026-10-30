// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { FactProposalPlaque } from './FactProposalPlaque'

const answer = vi.fn()
const hookState = {
	isPending: false,
	pendingAccept: null as boolean | null,
	notice: null as string | null,
}

vi.mock('../model/use-answer-fact-proposal', () => ({
	useAnswerFactProposal: () => ({ answer, ...hookState }),
}))

const ID = '0199b3a4-0000-7000-8000-000000000011'
const TEXT = 'змінний графік'

const renderPlaque = (status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED') =>
	render(
		<MemoryRouter>
			<FactProposalPlaque proposal={{ id: ID, text: TEXT, status }} />
		</MemoryRouter>,
	)

afterEach(() => {
	cleanup()
	answer.mockReset()
	Object.assign(hookState, { isPending: false, pendingAccept: null, notice: null })
})

describe('FactProposalPlaque', () => {
	it('asks and sends the answer of each button', () => {
		renderPlaque('PROPOSED')

		expect(screen.getByText(`Запам'ятати: «${TEXT}»?`)).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Так' }))
		fireEvent.click(screen.getByRole('button', { name: 'Ні' }))

		expect(answer).toHaveBeenNthCalledWith(1, true)
		expect(answer).toHaveBeenNthCalledWith(2, false)
	})

	it('locks both buttons while the answer is in flight', () => {
		Object.assign(hookState, { isPending: true, pendingAccept: true })
		renderPlaque('PROPOSED')

		expect(screen.getByRole('button', { name: /Так/ }).hasAttribute('disabled')).toBe(true)
		expect(screen.getByRole('button', { name: 'Ні' }).hasAttribute('disabled')).toBe(true)
	})

	it('shows the limit sentence under the buttons', () => {
		Object.assign(hookState, { notice: 'У пам’яті вже 30 фактів' })
		renderPlaque('PROPOSED')

		expect(screen.getByRole('status').textContent).toBe('У пам’яті вже 30 фактів')
		expect(screen.getByRole('button', { name: 'Ні' })).toBeTruthy()
	})

	it("says «Запам'ятав» with a link to «Про тебе» after «Так»", () => {
		renderPlaque('CONFIRMED')

		expect(screen.getByRole('status').textContent).toBe("Запам'ятав")
		expect(screen.getByRole('link', { name: "Змінити в «Пам'яті»" }).getAttribute('href')).toBe(
			'/app/memory?tab=facts',
		)
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('collapses to a muted line after «Ні»', () => {
		renderPlaque('REJECTED')

		expect(screen.getByText("Не запам'ятовую.")).toBeTruthy()
		expect(screen.queryByRole('button')).toBeNull()
	})
})
