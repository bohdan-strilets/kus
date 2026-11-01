import { describe, expect, it } from 'vitest'

import type { EvalCase } from './cases/index.js'
import {
	assertSmokeResolvable,
	EVAL_KEY_MISSING_MESSAGE,
	getSelectedIds,
	requireEvalKey,
	requireStage,
	SMOKE_EMPTY_MESSAGE,
	STAGE_REQUIRED_MESSAGE,
} from './cli-guards.js'

const makeCase = (id: string): EvalCase => ({ id }) as EvalCase

describe('requireEvalKey', () => {
	it('refuses without the eval key', () => {
		expect(() => requireEvalKey({})).toThrow(EVAL_KEY_MISSING_MESSAGE)
	})

	it('does not fall back to the production key', () => {
		expect(() => requireEvalKey({ OPENROUTER_API_KEY: 'prod' })).toThrow(EVAL_KEY_MISSING_MESSAGE)
	})

	it('returns the eval key', () => {
		expect(requireEvalKey({ OPENROUTER_EVAL_API_KEY: 'eval', OPENROUTER_API_KEY: 'prod' })).toBe(
			'eval',
		)
	})
})

describe('requireStage', () => {
	it('refuses a paid run without --stage', () => {
		expect(() => requireStage(undefined)).toThrow(STAGE_REQUIRED_MESSAGE)
		expect(STAGE_REQUIRED_MESSAGE).toContain('--stage-cap 1')
	})

	it('passes the stage through', () => {
		expect(requireStage('0.10.2')).toBe('0.10.2')
	})
})

describe('getSelectedIds', () => {
	it('selects nothing without --only and --smoke', () => {
		expect(getSelectedIds({ isSmoke: false, smokeIds: ['a'] })).toBeNull()
	})

	it('unites --only with the smoke list and drops duplicates', () => {
		const ids = getSelectedIds({ only: 'a, b', isSmoke: true, smokeIds: ['b', 'c'] })
		expect([...(ids ?? [])].sort()).toEqual(['a', 'b', 'c'])
	})

	it('ignores the smoke list when --smoke is off', () => {
		expect([...(getSelectedIds({ only: 'a', isSmoke: false, smokeIds: ['z'] }) ?? [])]).toEqual([
			'a',
		])
	})

	it('refuses an empty smoke list, even with --only', () => {
		expect(() => getSelectedIds({ isSmoke: true, smokeIds: [] })).toThrow(SMOKE_EMPTY_MESSAGE)
		expect(() => getSelectedIds({ only: 'a', isSmoke: true, smokeIds: [] })).toThrow(
			SMOKE_EMPTY_MESSAGE,
		)
	})
})

describe('assertSmokeResolvable', () => {
	const cases = [makeCase('a'), makeCase('private:x')]

	it('passes when every id resolves', () => {
		expect(() => {
			assertSmokeResolvable(['a', 'private:x'], cases)
		}).not.toThrow()
	})

	it('refuses unknown ids with their count', () => {
		expect(() => {
			assertSmokeResolvable(['a', 'nope', 'nada'], cases)
		}).toThrow('невідомих id: 2 (nope, nada)')
	})

	it('counts missing private ids without printing them', () => {
		let message = ''
		try {
			assertSmokeResolvable(['private:secret-1', 'private:secret-2', 'holdout:h'], [makeCase('a')])
		} catch (error) {
			message = error instanceof Error ? error.message : ''
		}
		expect(message).toContain('не знайдено 2 приватних кейсів')
		expect(message).toContain('невідомих id: 1')
		expect(message).not.toContain('secret')
		expect(message).not.toContain('holdout:h')
	})
})
