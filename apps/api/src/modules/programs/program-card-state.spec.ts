import { describe, expect, it } from 'vitest'

import { type CardStateInput, deriveProgramCardState } from './program-card-state'

const CARD = 'card-1'
const BASE = 'version-1'

const state = (overrides: Partial<CardStateInput> = {}) =>
	deriveProgramCardState({
		messageId: CARD,
		baseVersionId: BASE,
		acceptedAt: null,
		newestCardMessageId: CARD,
		activeVersionId: BASE,
		...overrides,
	})

describe('deriveProgramCardState', () => {
	it('is OPEN for the newest card made against the active version', () => {
		expect(state()).toEqual({ status: 'OPEN', versionCreatedAt: null })
	})

	it('is ACCEPTED with the version date, even once a newer card or version exists', () => {
		const acceptedAt = new Date('2026-11-01T10:00:00Z')

		expect(
			state({ acceptedAt, newestCardMessageId: 'card-2', activeVersionId: 'version-3' }),
		).toEqual({ status: 'ACCEPTED', versionCreatedAt: '2026-11-01T10:00:00.000Z' })
	})

	it('is REPLACED when a newer card exists', () => {
		expect(state({ newestCardMessageId: 'card-2' }).status).toBe('REPLACED')
	})

	it('is OUTDATED when the program moved on, was removed or appeared after a first-program card', () => {
		expect(state({ activeVersionId: 'version-2' }).status).toBe('OUTDATED')
		expect(state({ activeVersionId: null }).status).toBe('OUTDATED')
		expect(state({ baseVersionId: null, activeVersionId: 'version-2' }).status).toBe('OUTDATED')
		expect(state({ baseVersionId: null, activeVersionId: null }).status).toBe('OPEN')
	})
})
