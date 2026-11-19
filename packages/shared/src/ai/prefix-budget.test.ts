import { describe, expect, it } from 'vitest'

import { SYSTEM_PROMPT } from './prompt.js'
import { getAiFunctionTools } from './tools.js'

// The cached prefix (system prompt + tool schemas) is measured in real tokens only by eval.
// Calibration: prompt 2026-11-19.1 measured 24 671 cached prefix tokens at 62 382 characters
// (eval 0.13.0, 2026-11-19: cached_tokens of the single-turn requests, runs 13-34-56 and 13-35-44).
// Recalibrate both numbers after every eval that measures a new prefix.
const CALIBRATED_TOKENS = 24_671
const CALIBRATED_CHARS = 62_382
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
