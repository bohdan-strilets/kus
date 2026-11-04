// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useElementHeight } from './use-element-height'

const HEIGHT_PX = 120

interface ProbeProps {
	onChange: (heightPx: number) => void
	isShown?: boolean
}

const Probe = ({ onChange, isShown = true }: ProbeProps) => {
	const ref = useElementHeight(onChange)
	return isShown ? <div ref={ref} /> : null
}

const stubHeight = (): void => {
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
		configurable: true,
		get: () => HEIGHT_PX,
	})
}

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
})

describe('useElementHeight', () => {
	it('reports nothing without an element', () => {
		const onChange = vi.fn()

		render(<Probe onChange={onChange} isShown={false} />)

		expect(onChange).not.toHaveBeenCalled()
	})

	it('reports the height on mount and 0 on unmount', () => {
		stubHeight()
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		const onChange = vi.fn()
		const { unmount } = render(<Probe onChange={onChange} />)
		expect(onChange).toHaveBeenLastCalledWith(HEIGHT_PX)

		unmount()

		expect(onChange).toHaveBeenLastCalledWith(0)
	})

	it('does not fall over without ResizeObserver: measures once, 0 on unmount', () => {
		stubHeight()
		vi.stubGlobal('ResizeObserver', undefined)
		const onChange = vi.fn()

		const { unmount } = render(<Probe onChange={onChange} />)
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenLastCalledWith(HEIGHT_PX)

		unmount()

		expect(onChange).toHaveBeenLastCalledWith(0)
	})

	it('re-reports when the observer fires', () => {
		let fire: () => void = () => undefined
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					fire = callback
				}
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
		const onChange = vi.fn()
		render(<Probe onChange={onChange} />)
		stubHeight()

		fire()

		expect(onChange).toHaveBeenLastCalledWith(HEIGHT_PX)
	})
})
