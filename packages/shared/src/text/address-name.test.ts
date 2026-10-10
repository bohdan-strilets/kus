import { describe, expect, it } from 'vitest'

import { getAddressName } from './address-name.js'

describe('getAddressName', () => {
	it('takes «Як до тебе звертатися?» as typed, over the name', () => {
		expect(getAddressName({ name: 'Bohdan', addressAs: 'Богдане' })).toBe('Богдане')
		expect(getAddressName({ name: 'Богдан', addressAs: 'Бо' })).toBe('Бо')
	})

	it('falls back to the vocative of the name, or nothing', () => {
		expect(getAddressName({ name: 'Богдан', addressAs: null })).toBe('Богдане')
		expect(getAddressName({ name: null, addressAs: '  ' })).toBeNull()
	})
})
