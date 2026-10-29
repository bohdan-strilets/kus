// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOverlayStore } from '@/shared/lib'
import { renderWithProviders } from '@/shared/testing'

import { BaseBottomSheet } from '../bottom-sheet'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(() => {
	cleanup()
	useOverlayStore.setState({ count: 0 })
})

const renderDialog = (isOpen: boolean) =>
	renderWithProviders(
		<ConfirmDialog
			isOpen={isOpen}
			onOpenChange={vi.fn()}
			title="Видалити?"
			description="Точно?"
			cancelLabel="Скасувати"
			confirmLabel="Видалити"
			onConfirm={vi.fn()}
		/>,
	)

describe('overlays tell the screen they are open', () => {
	it('an open confirmation dialog counts as an overlay, a closed one does not', () => {
		const view = renderDialog(true)
		expect(useOverlayStore.getState().count).toBe(1)

		view.unmount()
		expect(useOverlayStore.getState().count).toBe(0)

		renderDialog(false)
		expect(useOverlayStore.getState().count).toBe(0)
	})

	it('an open bottom sheet counts too, and the two stack', () => {
		renderDialog(true)
		render(
			<BaseBottomSheet isOpen onOpenChange={vi.fn()} title="Sheet">
				<p>body</p>
			</BaseBottomSheet>,
		)

		expect(useOverlayStore.getState().count).toBe(2)
	})
})
