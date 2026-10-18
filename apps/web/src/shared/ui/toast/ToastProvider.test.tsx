// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { ToastProvider } from './ToastProvider'
import { useToast } from './use-toast'

afterEach(cleanup)

const Trigger = ({ onClick }: { onClick?: () => void }) => {
	const toast = useToast()
	return (
		<button
			type="button"
			onClick={() => {
				toast.show(
					'Замір видалено',
					onClick ? { action: { label: 'Повернути', onClick } } : undefined,
				)
			}}
		>
			show
		</button>
	)
}

describe('ToastProvider', () => {
	it('shows a plain message without a button', async () => {
		render(
			<ToastProvider>
				<Trigger />
			</ToastProvider>,
		)

		fireEvent.click(screen.getByText('show'))

		expect(await screen.findByText('Замір видалено')).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Повернути' })).toBeNull()
	})

	it('shows its action and calls it on tap', async () => {
		const onClick = vi.fn()
		render(
			<ToastProvider>
				<Trigger onClick={onClick} />
			</ToastProvider>,
		)

		fireEvent.click(screen.getByText('show'))
		const action = await screen.findByRole('button', { name: 'Повернути' })
		act(() => {
			action.click()
		})

		expect(onClick).toHaveBeenCalledTimes(1)
	})
})
