// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { NewDayGreeting } from './NewDayGreeting'

afterEach(cleanup)

describe('NewDayGreeting', () => {
	it('shows only the hint, without a greeting by name', () => {
		renderWithProviders(<NewDayGreeting />)

		expect(screen.getByText('Пиши, що їси, звичайними словами — я все порахую.')).toBeTruthy()
	})
})
