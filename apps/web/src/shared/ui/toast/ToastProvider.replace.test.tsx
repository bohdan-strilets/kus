// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { ToastProvider } from './ToastProvider'
import { useToast } from './use-toast'

const Trigger = ({ message, onUndo }: { message: string; onUndo?: () => void }) => {
	const toast = useToast()
	return (
		<button
			type="button"
			onClick={() => {
				toast.show(
					message,
					onUndo ? { action: { label: 'Скасувати', onClick: onUndo } } : undefined,
				)
			}}
		>
			{`show ${message}`}
		</button>
	)
}

const renderTriggers = (messages: { message: string; onUndo?: () => void }[]): void => {
	render(
		<ToastProvider>
			{messages.map(({ message, onUndo }) => (
				<Trigger key={message} message={message} onUndo={onUndo} />
			))}
		</ToastProvider>,
	)
}

const show = (message: string): void => {
	fireEvent.click(screen.getByText(`show ${message}`))
}

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true
})

afterEach(() => {
	MotionGlobalConfig.skipAnimations = false
	cleanup()
})

describe('ToastProvider: a toast with an action replaces the previous one with an action', () => {
	it('keeps only the newest «Скасувати» and calls only its handler', async () => {
		const firstUndo = vi.fn()
		const secondUndo = vi.fn()
		renderTriggers([
			{ message: 'Підхід 1 видалено', onUndo: firstUndo },
			{ message: 'Підхід 2 видалено', onUndo: secondUndo },
		])

		show('Підхід 1 видалено')
		expect(await screen.findByText('Підхід 1 видалено')).toBeTruthy()
		show('Підхід 2 видалено')

		await waitFor(() => {
			expect(screen.queryByText('Підхід 1 видалено')).toBeNull()
		})
		expect(screen.getByText('Підхід 2 видалено')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
		expect(secondUndo).toHaveBeenCalledTimes(1)
		expect(firstUndo).not.toHaveBeenCalled()
	})

	it('a plain toast is not replaced by a toast with an action', async () => {
		renderTriggers([{ message: 'Збережено' }, { message: 'Вправу видалено', onUndo: vi.fn() }])

		show('Збережено')
		expect(await screen.findByText('Збережено')).toBeTruthy()
		show('Вправу видалено')

		expect(await screen.findByText('Вправу видалено')).toBeTruthy()
		expect(screen.getByText('Збережено')).toBeTruthy()
	})
})

describe('ToastProvider: a plain toast replaces nothing', () => {
	it('keeps the toast with an action when a plain one comes', async () => {
		renderTriggers([{ message: 'Вправу видалено', onUndo: vi.fn() }, { message: 'Збережено' }])

		show('Вправу видалено')
		expect(await screen.findByText('Вправу видалено')).toBeTruthy()
		show('Збережено')

		expect(await screen.findByText('Збережено')).toBeTruthy()
		expect(screen.getByText('Вправу видалено')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy()
	})

	it('two plain toasts live side by side', async () => {
		renderTriggers([{ message: 'Один' }, { message: 'Два' }])

		show('Один')
		show('Два')

		expect(await screen.findByText('Два')).toBeTruthy()
		expect(screen.getByText('Один')).toBeTruthy()
	})
})
