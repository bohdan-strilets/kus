// @vitest-environment jsdom
import { WORKOUT_APPEND_MAX_GAP_HOURS } from '@kus/shared'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/shared/i18n'
import { renderWithProviders } from '@/shared/testing'

import { ExitWorkoutDialog } from './ExitWorkoutDialog'

const SUMMARY = 'Зроблено 5 підходів за 23 хв.'
const DESCRIPTION =
	'Зроблено 5 підходів за 23 хв. Можна продовжити пізніше — тренування закриється саме, якщо від останнього підходу мине понад 3 години.'

const renderDialog = (overrides: Partial<Parameters<typeof ExitWorkoutDialog>[0]> = {}) => {
	const onOpenChange = vi.fn()
	const onDiscard = vi.fn()
	renderWithProviders(
		<ExitWorkoutDialog
			isOpen
			onOpenChange={onOpenChange}
			summary={SUMMARY}
			onDiscard={onDiscard}
			isDiscarding={false}
			{...overrides}
		/>,
	)
	return { onOpenChange, onDiscard }
}

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

describe('ExitWorkoutDialog', () => {
	it('with done sets it says what is made and that the session closes by itself, word for word', () => {
		renderDialog()

		expect(WORKOUT_APPEND_MAX_GAP_HOURS).toBe(3)
		expect(screen.getByText(DESCRIPTION)).toBeTruthy()
		expect(screen.getByRole('alertdialog').textContent).toContain(DESCRIPTION)
	})

	it('the description is linked to the dialog for assistive tech', () => {
		renderDialog()

		const dialog = screen.getByRole('alertdialog')
		const describedBy = dialog.getAttribute('aria-describedby')

		expect(describedBy).toBeTruthy()
		expect(document.getElementById(describedBy ?? '')?.textContent).toBe(DESCRIPTION)
	})

	it('without done sets there is no description and no summary, only the title and the buttons', () => {
		renderDialog({ summary: null })

		const dialog = screen.getByRole('alertdialog')

		expect(screen.getByText('Вийти без збереження?')).toBeTruthy()
		expect(dialog.textContent).not.toContain('Зроблено')
		expect(dialog.textContent).not.toContain('Можна продовжити')
		expect(dialog.textContent).not.toContain('мине понад')
		expect(screen.getByRole('button', { name: 'Вийти без збереження' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy()
	})

	it('without a description Radix has nothing to warn about (no aria-describedby warning)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

		renderDialog({ summary: null })

		const messages = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
		expect(messages.filter((message) => /Description|aria-describedby/.test(message))).toEqual([])
	})

	it('has no «Продовжити пізніше» button, with or without a summary', () => {
		renderDialog()
		expect(screen.queryByRole('button', { name: 'Продовжити пізніше' })).toBeNull()
		cleanup()

		renderDialog({ summary: null })
		expect(screen.queryByRole('button', { name: 'Продовжити пізніше' })).toBeNull()
		expect(screen.getAllByRole('button')).toHaveLength(2)
	})

	it('«Вийти без збереження» discards, «Скасувати» closes without discarding', () => {
		const { onDiscard, onOpenChange } = renderDialog()

		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))

		expect(onOpenChange).toHaveBeenCalledWith(false)
		expect(onDiscard).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole('button', { name: 'Вийти без збереження' }))

		expect(onDiscard).toHaveBeenCalledTimes(1)
	})

	it('renders nothing when closed', () => {
		renderDialog({ isOpen: false })

		expect(screen.queryByRole('alertdialog')).toBeNull()
	})
})

describe('hours unit of the exit description (plural keys training.live.exit.hoursUnit_*)', () => {
	it.each([
		[1, 'година'],
		[2, 'години'],
		[3, 'години'],
		[5, 'годин'],
		[11, 'годин'],
		[21, 'година'],
		[22, 'години'],
	])('%i -> %s', (count, unit) => {
		expect(i18n.t('training.live.exit.hoursUnit', { count })).toBe(unit)
	})

	it.each([
		[1, 'понад 1 година'],
		[2, 'понад 2 години'],
		[5, 'понад 5 годин'],
		[21, 'понад 21 година'],
	])('the whole sentence for %i hours ends with «%s»', (hours, tail) => {
		const unit = i18n.t('training.live.exit.hoursUnit', { count: hours })

		const text = i18n.t('training.live.exit.description', { summary: SUMMARY, hours, unit })

		expect(text.endsWith(`мине ${tail}.`)).toBe(true)
	})
})
