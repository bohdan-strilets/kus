// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MeterBar } from './MeterBar'

const renderBar = (percent: number) => {
	const { container } = render(<MeterBar percent={percent} fillClassName="bg-success" />)
	const track = container.firstElementChild as HTMLElement
	return { track, fill: track.firstElementChild as HTMLElement | null }
}

describe('MeterBar', () => {
	afterEach(cleanup)

	it('draws no fill at 0', () => {
		expect(renderBar(0).fill).toBeNull()
	})

	it('keeps a visible minimum for a small share', () => {
		const { fill } = renderBar(3)
		expect(fill?.classList.contains('min-w-2')).toBe(true)
		expect(fill?.classList.contains('bg-success')).toBe(true)
		expect(fill?.style.width).toBe('3%')
	})

	it('sets the width as a percent', () => {
		expect(renderBar(50).fill?.style.width).toBe('50%')
	})

	it('clamps above 100', () => {
		expect(renderBar(150).fill?.style.width).toBe('100%')
	})

	it('clamps negative values to an empty bar', () => {
		expect(renderBar(-20).fill).toBeNull()
	})

	it('is hidden from assistive tech', () => {
		expect(renderBar(50).track.getAttribute('aria-hidden')).toBe('true')
	})
})
