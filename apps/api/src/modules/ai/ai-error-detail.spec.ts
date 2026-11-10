import { describe, expect, it } from 'vitest'

import { toValidationErrorDetail } from './ai-error-detail'

describe('toValidationErrorDetail', () => {
	it('keeps the technical part and joins the errors', () => {
		expect(
			toValidationErrorDetail(['log_food: items.0.kcal is too large', 'clarify: ref e7 is closed']),
		).toBe('log_food: items.0.kcal is too large; clarify: ref e7 is closed')
	})

	it('masks quoted text (a food name) and numbers (a weight)', () => {
		const detail = toValidationErrorDetail([
			'save_food: foods.0 "Борщ бабусі" is already saved as m3 — ask the user',
			'log_measurement: WEIGHT 72.4 is outside 20–400 kg — do not log',
		])
		expect(detail).not.toContain('Борщ')
		expect(detail).not.toContain('72')
		expect(detail).toBe(
			'save_food: foods.0 "…" is already saved as m3; log_measurement: WEIGHT # is outside #–# kg',
		)
	})

	it('masks a number glued to its unit, but not refs and path indexes', () => {
		expect(toValidationErrorDetail(['log_measurement: WEIGHT 72kg is above 5000ккал'])).toBe(
			'log_measurement: WEIGHT #kg is above #ккал',
		)
		expect(toValidationErrorDetail(['clarify: items.0 ref e7 and m3 are closed'])).toBe(
			'clarify: items.0 ref e7 and m3 are closed',
		)
	})

	it('cuts the result to 500 characters', () => {
		expect(toValidationErrorDetail(['x'.repeat(2000)])).toHaveLength(500)
	})
})
