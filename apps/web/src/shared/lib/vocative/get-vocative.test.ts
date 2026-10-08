import { describe, expect, it } from 'vitest'

import { getVocative } from './get-vocative'

describe('getVocative', () => {
	it.each([
		['Богдан', 'Богдане'],
		['Олена', 'Олено'],
		['Андрій', 'Андрію'],
		['Микола', 'Миколо'],
		['Ольга', 'Ольго'],
		['Марія', 'Маріє'],
		['Дмитро', 'Дмитре'],
		['Василь', 'Василю'],
		['Олександр', 'Олександре'],
		['Ігор', 'Ігорю'],
		['Олег', 'Олеже'],
		['Лев', 'Льве'],
		['Марк', 'Марку'],
		['  тарас ', 'Тарасе'],
	])('%s → %s', (name, vocative) => {
		expect(getVocative(name)).toBe(vocative)
	})

	it.each(['Bohdan', 'Анна Марія', 'Таня', 'Наталя', 'Ю', ''])(
		'gives no form for «%s» rather than guessing',
		(name) => {
			expect(getVocative(name)).toBeNull()
		},
	)
})
