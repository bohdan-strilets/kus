// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/shared/i18n'
import { stubMatchMedia } from '@/shared/testing'

import { Hamster } from './Hamster'
import { HAMSTER_LABEL_KEYS } from './hamster.constants'

vi.mock('motion', () => ({ animate: vi.fn() }))

beforeEach(() => {
	stubMatchMedia()
})

afterEach(cleanup)

describe('Hamster dumbbell', () => {
	it('is spoken as a hamster with a dumbbell', () => {
		render(<Hamster mood="dumbbell" label={i18n.t(HAMSTER_LABEL_KEYS.dumbbell)} />)

		expect(screen.getByRole('img', { name: "Хом'як з гантеллю" })).toBeTruthy()
	})

	it('holds a dumbbell instead of the gingerbread', () => {
		const { container } = render(<Hamster mood="dumbbell" />)

		expect(container.querySelector('svg')?.getAttribute('data-mood')).toBe('dumbbell')
		// the cookie carries its own <text>
		expect(container.querySelector('text')).toBeNull()
		expect(container.querySelector('path[stroke="#6B5D50"]')).toBeTruthy()
		expect(container.querySelectorAll('rect[fill="#4F4237"]').length).toBeGreaterThanOrEqual(2)
	})

	it('is decorative without a label', () => {
		const { container } = render(<Hamster mood="dumbbell" />)

		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
		expect(screen.queryByRole('img')).toBeNull()
	})
})
