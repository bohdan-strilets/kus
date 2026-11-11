// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { useViewportBox, type ViewportBox } from '@/shared/lib'

import { ToastProvider } from './ToastProvider'

vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useViewportBox: vi.fn(),
}))

afterEach(cleanup)

const renderViewport = (box: ViewportBox): HTMLElement => {
	vi.mocked(useViewportBox).mockReturnValue(box)
	render(
		<ToastProvider>
			<span />
		</ToastProvider>,
	)
	const list = document.querySelector('ol')
	if (!list) throw new Error('toast viewport not rendered')
	return list
}

describe('ToastProvider viewport', () => {
	it('follows the visual viewport when iOS pans it under the keyboard', () => {
		const list = renderViewport({ height: 400, offsetTop: 300 })

		expect(list.classList.contains('fixed')).toBe(true)
		expect(list.style.transform).toBe('translateY(300px)')
	})

	it('adds no style without visualViewport', () => {
		const list = renderViewport({ height: null, offsetTop: 0 })

		expect(list.getAttribute('style')).toBeNull()
	})
})
