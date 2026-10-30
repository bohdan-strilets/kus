import { describe, expect, it } from 'vitest'

import { getFactProposalView } from './get-fact-proposal-view'

const ID = '0199b3a4-0000-7000-8000-000000000011'
const TEXT = 'Не їсть рибу'

describe('getFactProposalView', () => {
	it('asks while the proposal waits for an answer', () => {
		expect(getFactProposalView({ id: ID, text: TEXT, status: 'PROPOSED' })).toBe('ask')
	})

	it('shows the saved line for a confirmed fact, asked or explicit', () => {
		expect(getFactProposalView({ id: ID, text: TEXT, status: 'CONFIRMED' })).toBe('saved')
	})

	it('collapses a rejected proposal', () => {
		expect(getFactProposalView({ id: ID, text: TEXT, status: 'REJECTED' })).toBe('rejected')
	})
})
