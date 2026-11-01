import { describe, expect, it } from 'vitest'

import { toggleEquipment } from './toggle-equipment'

describe('toggleEquipment', () => {
	it('adds and removes an option', () => {
		expect(toggleEquipment(['FULL_GYM'], 'BANDS')).toEqual(['FULL_GYM', 'BANDS'])
		expect(toggleEquipment(['FULL_GYM', 'BANDS'], 'FULL_GYM')).toEqual(['BANDS'])
	})

	it('«Нічого» clears the rest', () => {
		expect(toggleEquipment(['FULL_GYM', 'BANDS'], 'NONE')).toEqual(['NONE'])
	})

	it('any option drops «Нічого»', () => {
		expect(toggleEquipment(['NONE'], 'DUMBBELLS')).toEqual(['DUMBBELLS'])
	})

	it('«Нічого» can be taken off', () => {
		expect(toggleEquipment(['NONE'], 'NONE')).toEqual([])
	})
})
