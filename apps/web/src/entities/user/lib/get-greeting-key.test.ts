import { describe, expect, it } from 'vitest'

import { getGreetingKey } from './get-greeting-key'

describe('getGreetingKey', () => {
	it.each([
		[4, 'chat.greeting.morning'],
		[11, 'chat.greeting.morning'],
		[12, 'chat.greeting.day'],
		[17, 'chat.greeting.day'],
		[18, 'chat.greeting.evening'],
		[23, 'chat.greeting.evening'],
		[2, 'chat.greeting.evening'],
	])('%i:00 → %s', (hour, key) => {
		expect(getGreetingKey(hour)).toBe(key)
	})
})
