import { describe, expect, it } from 'vitest'

import { evalCaseSchema } from './case.types.js'

const base = { id: 'c', expect: { decision: 'log' }, reference: 'r' }

describe('evalCaseSchema', () => {
	it('takes words, a photo, or both', () => {
		expect(evalCaseSchema.safeParse({ ...base, text: '150 г' }).success).toBe(true)
		expect(evalCaseSchema.safeParse({ ...base, image: 'photos/skyr.jpg' }).success).toBe(true)
		expect(
			evalCaseSchema.safeParse({ ...base, text: '150 г', image: 'photos/skyr.jpg' }).success,
		).toBe(true)
	})

	it('needs at least one of them', () => {
		expect(evalCaseSchema.safeParse(base).success).toBe(false)
		expect(evalCaseSchema.safeParse({ ...base, text: '' }).success).toBe(false)
	})

	it('reads a photo-only case with an empty text', () => {
		const parsed = evalCaseSchema.parse({ ...base, image: 'photos/skyr.jpg' })
		expect(parsed.text).toBe('')
	})

	it('accepts expected sources and photo_unusable', () => {
		const parsed = evalCaseSchema.parse({
			...base,
			image: 'photos/skyr.jpg',
			expect: { decision: 'photo_unusable', sources: ['LABEL'] },
		})
		expect(parsed.expect).toMatchObject({ decision: 'photo_unusable', sources: ['LABEL'] })
	})
})
