// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { KcalInfoSheet } from './KcalInfoSheet'

afterEach(cleanup)

describe('KcalInfoSheet', () => {
	it('is closed by default', () => {
		renderWithProviders(<KcalInfoSheet isOpen={false} onOpenChange={() => undefined} />)

		expect(screen.queryByRole('dialog')).toBeNull()
	})

	it('says how the number is made and that it never joins the goal', () => {
		renderWithProviders(<KcalInfoSheet isOpen onOpenChange={() => undefined} />)

		expect(screen.getByRole('dialog', { name: 'Ккал на тренуванні' })).toBeTruthy()
		expect(screen.getByText(/Якщо число назвали/)).toBeTruthy()
		expect(screen.getByText(/Це приблизне число\./)).toBeTruthy()
		const bold = screen.getByText('До цілі на день не додається')
		expect(bold.tagName).toBe('B')
		expect(screen.getByText(/«лишилось» не змінює/)).toBeTruthy()
	})

	it('closes by «Зрозуміло»', () => {
		const changes: boolean[] = []
		renderWithProviders(
			<KcalInfoSheet
				isOpen
				onOpenChange={(isOpen) => {
					changes.push(isOpen)
				}}
			/>,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Зрозуміло' }))

		expect(changes).toEqual([false])
	})
})
