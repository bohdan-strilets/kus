import { describe, expect, it } from 'vitest'

import { getWaitingPhraseKey } from './get-waiting-phrase-key'

describe('getWaitingPhraseKey', () => {
	it.each([
		[0, 'chat.waiting.thinking'],
		[2499, 'chat.waiting.thinking'],
		[2500, 'chat.waiting.second'],
		[5000, 'chat.waiting.almost'],
		[7999, 'chat.waiting.almost'],
		[8000, 'chat.waiting.long'],
		[60_000, 'chat.waiting.long'],
	])('after %i ms says %s', (elapsedMs, key) => {
		expect(getWaitingPhraseKey(elapsedMs)).toBe(key)
	})
})
