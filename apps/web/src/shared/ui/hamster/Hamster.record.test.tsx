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

describe('Hamster record', () => {
	it('is spoken as a hamster rejoicing at a record', () => {
		render(<Hamster mood="record" label={i18n.t(HAMSTER_LABEL_KEYS.record)} />)

		expect(screen.getByRole('img', { name: "Хом'як радіє рекорду" })).toBeTruthy()
	})

	it('carries its mood and holds a trophy instead of the gingerbread', () => {
		const { container } = render(<Hamster mood="record" />)

		expect(container.querySelector('svg')?.getAttribute('data-mood')).toBe('record')
		// the cookie carries its own <text>
		expect(container.querySelector('text')).toBeNull()
		expect(container.querySelector('path[stroke="#D9A03A"]')).toBeTruthy()
	})

	it('is decorative without a label', () => {
		const { container } = render(<Hamster mood="record" />)

		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
		expect(screen.queryByRole('img')).toBeNull()
	})
})
