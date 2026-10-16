import { describe, expect, it } from 'vitest'

import { getPhotoUrl } from './get-photo-url'

const FILE_ID = '0199b3a4-0000-7000-8000-0000000000f1'

describe('getPhotoUrl', () => {
	it('points to the same-origin API thumb', () => {
		expect(getPhotoUrl(FILE_ID, 'thumb')).toBe(`/api/v1/photos/${FILE_ID}?variant=thumb`)
	})

	it('takes the variant', () => {
		expect(getPhotoUrl(FILE_ID, 'full')).toBe(`/api/v1/photos/${FILE_ID}?variant=full`)
	})

	it('does not let an id leave the photos path', () => {
		const url = getPhotoUrl('../auth/logout?x=', 'thumb')

		expect(new URL(url, 'http://localhost').pathname.startsWith('/api/v1/photos/')).toBe(true)
	})
})
