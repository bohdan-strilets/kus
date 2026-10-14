// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubMatchMedia } from '@/shared/testing'

import { Hamster } from './Hamster'

vi.mock('motion', () => ({ animate: vi.fn() }))

// the cookie carries its own <text>, so the medal is found by its position
const BADGE_TEXT_SELECTOR = 'text[x="102"]'
const BADGE_STAR_SELECTOR = 'path[d^="M102 19.5"]'
const BADGE_CIRCLE_SELECTOR = 'circle[cx="102"][cy="28"]'

beforeEach(() => {
	stubMatchMedia()
})

afterEach(cleanup)

describe('Hamster badge', () => {
	it('shows the number on the proud medal', () => {
		const { container } = render(<Hamster mood="proud" badge={7} />)
		expect(container.querySelector(BADGE_TEXT_SELECTOR)?.textContent).toBe('7')
		expect(container.querySelector(BADGE_STAR_SELECTOR)).toBeNull()
	})

	it('shrinks the font for three characters', () => {
		const { container } = render(<Hamster mood="proud" badge="105" />)
		const text = container.querySelector(BADGE_TEXT_SELECTOR)
		expect(text?.textContent).toBe('105')
		expect(text?.getAttribute('font-size')).toBe('11')
	})

	it('falls back to a star without a badge', () => {
		const { container } = render(<Hamster mood="proud" />)
		expect(container.querySelector(BADGE_TEXT_SELECTOR)).toBeNull()
		expect(container.querySelector(BADGE_STAR_SELECTOR)).not.toBeNull()
	})

	it('ignores the badge on other moods', () => {
		const { container } = render(<Hamster mood="happy" badge={7} />)
		expect(container.querySelector(BADGE_TEXT_SELECTOR)).toBeNull()
		expect(container.querySelector(BADGE_CIRCLE_SELECTOR)).toBeNull()
	})
})
