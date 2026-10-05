import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
	it('drops falsy values', () => {
		expect(cn('flex', false, undefined, 'gap-2')).toBe('flex gap-2')
	})

	it('lets the later Tailwind class win on conflict', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4')
	})
})
