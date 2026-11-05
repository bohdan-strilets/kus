import { describe, expect, it } from 'vitest'

import { SYSTEM_PROMPT } from './prompt.js'
import { getAiFunctionTools } from './tools.js'

// The cached prefix (system prompt + tool schemas) is measured in real tokens only by eval.
// Calibration: prompt 2026-11-05.2 measured 20 011 tokens at 50 367 characters (cached tokens of
// every warm eval case on 2026-11-05.2).
// Recalibrate both numbers after every eval that measures a new prefix.
const CALIBRATED_TOKENS = 20_011
const CALIBRATED_CHARS = 50_367
// Ceiling set by the author (PROMPT_CHANGELOG.md); it does not grow without their decision.
const PREFIX_TOKEN_CEILING = 25_000

const countPrefixChars = (): number =>
	SYSTEM_PROMPT.length + JSON.stringify(getAiFunctionTools()).length

const estimatePrefixTokens = (): number =>
	Math.ceil((countPrefixChars() * CALIBRATED_TOKENS) / CALIBRATED_CHARS)

describe('prompt prefix budget', () => {
	it(`stays within ${PREFIX_TOKEN_CEILING} tokens`, () => {
		const estimate = estimatePrefixTokens()

		expect(
			estimate,
			`prefix ≈ ${estimate} tokens (${countPrefixChars()} chars), ceiling ${PREFIX_TOKEN_CEILING}`,
		).toBeLessThanOrEqual(PREFIX_TOKEN_CEILING)
	})
})
