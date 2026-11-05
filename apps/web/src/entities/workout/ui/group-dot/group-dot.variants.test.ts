import { describe, expect, it } from 'vitest'

import { getGroupInkClass } from './group-dot.variants'

const EXPECTED: Readonly<Record<string, string>> = {
	CARDIO: 'bg-muscle-cardio-ink',
	CHEST: 'bg-muscle-chest-ink',
	BACK: 'bg-muscle-back-ink',
	LEGS: 'bg-muscle-legs-ink',
	SHOULDERS: 'bg-muscle-shoulders-ink',
	ARMS: 'bg-muscle-arms-ink',
	CORE: 'bg-muscle-core-ink',
}

describe('getGroupInkClass', () => {
	it.each(Object.entries(EXPECTED))('gives the ink class of %s', (group, cls) => {
		expect(getGroupInkClass(group as Parameters<typeof getGroupInkClass>[0])).toBe(cls)
	})

	it('gives the neutral class for a null group', () => {
		expect(getGroupInkClass(null)).toBe('bg-muted-soft')
	})
})
