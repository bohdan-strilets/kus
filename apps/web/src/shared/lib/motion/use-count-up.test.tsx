// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { countUp } from './motion.imperative'
import { useCountUp } from './use-count-up'

vi.mock('./motion.imperative', () => ({ countUp: vi.fn() }))

interface ProbeProps {
	value: number
	from?: number
	initial?: number
}

const Probe = ({ value, from, initial }: ProbeProps) => {
	const ref = useCountUp<HTMLSpanElement>(value, { from, initial })
	return <span ref={ref} data-testid="count" />
}

const countUpMock = vi.mocked(countUp)
let stops: Array<ReturnType<typeof vi.fn>> = []

beforeEach(() => {
	stops = []
	countUpMock.mockReset()
	countUpMock.mockImplementation(() => {
		const stop = vi.fn()
		stops.push(stop)
		return stop
	})
})

afterEach(() => {
	cleanup()
})

describe('useCountUp', () => {
	it('counts from 0 on the first show without initial', () => {
		const { getByTestId } = render(<Probe value={1200} />)

		expect(countUpMock).toHaveBeenCalledTimes(1)
		expect(countUpMock).toHaveBeenCalledWith(getByTestId('count'), 0, 1200, expect.anything())
	})

	it('does not animate on mount when initial equals value, then counts from the previous value', () => {
		const { getByTestId, rerender } = render(<Probe value={600} initial={600} />)

		expect(countUpMock).toHaveBeenCalledTimes(1)
		expect(countUpMock).toHaveBeenLastCalledWith(getByTestId('count'), 600, 600, expect.anything())

		rerender(<Probe value={900} initial={600} />)

		expect(countUpMock).toHaveBeenCalledTimes(2)
		expect(countUpMock).toHaveBeenLastCalledWith(getByTestId('count'), 600, 900, expect.anything())
	})

	it('starts from initial when it differs from value', () => {
		render(<Probe value={800} initial={500} />)

		expect(countUpMock).toHaveBeenCalledWith(expect.anything(), 500, 800, expect.anything())
	})

	it('prefers from over initial and over the previous value', () => {
		const { rerender } = render(<Probe value={800} initial={500} from={100} />)
		expect(countUpMock).toHaveBeenLastCalledWith(expect.anything(), 100, 800, expect.anything())

		rerender(<Probe value={950} initial={500} from={100} />)
		expect(countUpMock).toHaveBeenLastCalledWith(expect.anything(), 100, 950, expect.anything())
	})

	it('stops the previous count when the value changes', () => {
		const { rerender } = render(<Probe value={100} />)
		expect(stops[0]).not.toHaveBeenCalled()

		rerender(<Probe value={200} />)

		expect(stops[0]).toHaveBeenCalledTimes(1)
		expect(stops[1]).not.toHaveBeenCalled()
	})

	it('stops the running count on unmount', () => {
		const { unmount } = render(<Probe value={100} />)

		unmount()

		expect(stops[0]).toHaveBeenCalledTimes(1)
	})
})
