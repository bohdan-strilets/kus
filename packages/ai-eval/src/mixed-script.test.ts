import { describe, expect, it } from 'vitest'

import { findMixedScriptWords } from './mixed-script.js'

describe('findMixedScriptWords', () => {
	it('finds a Cyrillic word with a Latin letter', () => {
		expect(findMixedScriptWords('Записав курячa грудка')).toEqual(['курячa'])
	})

	it('ignores purely Ukrainian and purely Latin words', () => {
		expect(findMixedScriptWords('Записав куряче філе')).toEqual([])
		expect(findMixedScriptWords('Snickers')).toEqual([])
	})

	it('ignores a Latin brand next to Cyrillic words', () => {
		expect(findMixedScriptWords('Записав Snickers на обід')).toEqual([])
	})

	it('does not merge words across a hyphen', () => {
		expect(findMixedScriptWords('кисло-sweet соус')).toEqual([])
	})

	it('returns each mixed word once', () => {
		expect(findMixedScriptWords('курячa і ще раз курячa')).toEqual(['курячa'])
	})
})
