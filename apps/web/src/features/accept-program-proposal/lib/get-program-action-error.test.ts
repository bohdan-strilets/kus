import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/shared/api'

import { getProgramActionError } from './get-program-action-error'

const t = ((key: string) => key) as TFunction

const http = (status: number, errorCode: string): ApiError => ({
	kind: 'http',
	status,
	errorCode,
	details: {},
})

describe('getProgramActionError', () => {
	it.each([
		'PROGRAM_VERSION_CONFLICT',
		'PROGRAM_PROPOSAL_NOT_FOUND',
		'PROGRAM_PROPOSAL_ALREADY_ACCEPTED',
		'PROGRAM_PROPOSAL_REPLACED',
		'PROGRAM_PROPOSAL_INVALID',
	])('says the server code %s in its own words', (code) => {
		expect(getProgramActionError(http(409, code), t)).toBe(`errors.api.${code}`)
	})

	it('says the connection error for a network failure', () => {
		expect(getProgramActionError({ kind: 'network' }, t)).toBe('errors.api.NETWORK')
	})

	it('falls back to the generic sentence for an unknown code or kind', () => {
		expect(getProgramActionError(http(500, 'INTERNAL'), t)).toBe('program.card.actionError')
		expect(getProgramActionError({ kind: 'unknown' }, t)).toBe('program.card.actionError')
	})
})
