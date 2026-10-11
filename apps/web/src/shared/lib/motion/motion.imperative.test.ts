// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubMatchMedia } from '@/shared/testing'

import { formatInteger } from '../format'
import { countUp, fillArc } from './motion.imperative'

vi.mock('motion', () => ({ animate: vi.fn() }))

const { animate } = await import('motion')

const ARC_LENGTH = 200

beforeEach(() => {
	stubMatchMedia()
})

afterEach(() => {
	vi.clearAllMocks()
})

describe('countUp', () => {
	it('sets the number at once when it is already on screen', () => {
		const element = document.createElement('span')
		countUp(element, 1370, 1370)
		expect(element.textContent).toBe(formatInteger(1370))
		expect(animate).not.toHaveBeenCalled()
	})

	it('animates from the previous value to the new one', () => {
		const element = document.createElement('span')
		vi.mocked(animate).mockReturnValue({ stop: vi.fn() } as never)
		countUp(element, 1370, 1200)
		expect(animate).toHaveBeenCalledWith(1370, 1200, expect.objectContaining({ duration: 0.5 }))
	})
})

describe('fillArc', () => {
	const createArc = (): SVGPathElement => {
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
		Object.assign(path, { getTotalLength: () => ARC_LENGTH })
		return path
	}

	it('draws the arc at once from the ratio it already shows', async () => {
		const path = createArc()
		await fillArc(path, 0.4, { fromRatio: 0.4 })
		expect(path.style.strokeDashoffset).toBe(String(ARC_LENGTH * 0.6))
		expect(animate).not.toHaveBeenCalled()
	})

	it('draws the arc at once with a zero duration', async () => {
		const path = createArc()
		await fillArc(path, 1, { fromRatio: 0.4, durationMs: 0 })
		expect(path.style.strokeDashoffset).toBe('0')
		expect(animate).not.toHaveBeenCalled()
	})

	it('animates from the previous ratio, not from 0', async () => {
		const path = createArc()
		vi.mocked(animate).mockResolvedValue(undefined)
		await fillArc(path, 0.7, { fromRatio: 0.4 })
		expect(animate).toHaveBeenCalledWith(
			path,
			{ strokeDashoffset: [ARC_LENGTH * 0.6, ARC_LENGTH * (1 - 0.7)] },
			expect.objectContaining({ duration: 0.7 }),
		)
	})
})
