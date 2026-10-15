import { format, inspect } from 'node:util'
import { describe, expect, it } from 'vitest'

import { PhotoPayload } from './photo-payload'

const BYTES = Buffer.alloc(1_300_000, 0xab)
const BASE64 = BYTES.toString('base64')

describe('PhotoPayload', () => {
	const photo = new PhotoPayload('image/jpeg', BYTES, 640, 480)

	it.each([
		['JSON.stringify', () => JSON.stringify({ photo })],
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- that is the case under test
		['a template string', () => `${photo}`],
		['util.inspect', () => inspect(photo)],
		['util.format %o', () => format('%o', photo)],
		['util.format %s', () => format('%s', photo)],
		['inspect of a wrapping object', () => inspect({ params: { photo } }, { depth: 5 })],
	])('prints a mask, not the bytes, through %s', (_name, print) => {
		const printed = print()
		expect(printed).toContain('[image 1.2 MB]')
		expect(printed).not.toContain(BASE64.slice(0, 40))
		expect(printed.length).toBeLessThan(100)
	})

	it('shows kilobytes for a small photo and still gives the bytes explicitly', () => {
		const small = new PhotoPayload('image/png', Buffer.alloc(2048), 64, 64)
		expect(String(small)).toBe('[image 2.0 KB]')
		expect(small.bytes.length).toBe(2048)
		expect(small.sizeBytes).toBe(2048)
	})
})
