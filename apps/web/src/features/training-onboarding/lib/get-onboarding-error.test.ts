import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/shared/api'

import { getOnboardingActionError } from './get-onboarding-error'

const t = ((key: string) => key) as TFunction

const http = (status: number, errorCode: string): ApiError => ({
	kind: 'http',
	status,
	errorCode,
	details: {},
})

describe('getOnboardingActionError', () => {
	it.each(['TRAINING_ONBOARDING_NOT_FOUND', 'TRAINING_ONBOARDING_CLOSED'])(
		'says the server code %s in its own words',
		(code) => {
			expect(getOnboardingActionError(http(409, code), t)).toBe(`errors.api.${code}`)
		},
	)

	it('says the connection error for a network failure', () => {
		expect(getOnboardingActionError({ kind: 'network' }, t)).toBe('errors.api.NETWORK')
	})

	it('falls back to the generic sentence for anything else', () => {
		expect(getOnboardingActionError(http(500, 'INTERNAL'), t)).toBe(
			'trainingOnboarding.actionError',
		)
		expect(getOnboardingActionError({ kind: 'unknown' }, t)).toBe('trainingOnboarding.actionError')
	})
})
