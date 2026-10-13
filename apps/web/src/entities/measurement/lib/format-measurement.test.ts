import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import {
	formatMeasurement,
	formatMeasurementDelta,
	formatMeasurementNumber,
	formatTargetWeight,
} from './format-measurement'

describe('formatTargetWeight', () => {
	it('drops a useless zero and keeps a real decimal with the Ukrainian comma', () => {
		expect(formatTargetWeight(78, i18n.t)).toBe('78 кг')
		expect(formatTargetWeight(78.0, i18n.t)).toBe('78 кг')
		expect(formatTargetWeight(78.5, i18n.t)).toBe('78,5 кг')
	})

	it('leaves the current weight with one decimal', () => {
		expect(formatMeasurement(78, 'WEIGHT', i18n.t)).toBe('78,0 кг')
	})
})

describe('formatMeasurementNumber', () => {
	it('keeps a tenth for weight, even a whole one', () => {
		expect(formatMeasurementNumber(82, 'WEIGHT')).toBe('82,0')
		expect(formatMeasurementNumber(82.4, 'WEIGHT')).toBe('82,4')
	})

	it('drops the decimal of a whole waist and keeps a real one', () => {
		expect(formatMeasurementNumber(94, 'WAIST')).toBe('94')
		expect(formatMeasurementNumber(94.0, 'WAIST')).toBe('94')
		expect(formatMeasurementNumber(94.5, 'WAIST')).toBe('94,5')
	})
})

describe('formatMeasurement for a waist', () => {
	it('writes centimetres', () => {
		expect(formatMeasurement(94, 'WAIST', i18n.t)).toBe('94 см')
		expect(formatMeasurement(94.5, 'WAIST', i18n.t)).toBe('94,5 см')
	})
})

describe('formatMeasurementDelta', () => {
	it('signs a weight change with a typographic minus and a plus', () => {
		expect(formatMeasurementDelta(-1.6, 'WEIGHT', i18n.t)).toBe('−1,6 кг')
		expect(formatMeasurementDelta(0.3, 'WEIGHT', i18n.t)).toBe('+0,3 кг')
	})

	it('signs a whole waist change without a decimal', () => {
		expect(formatMeasurementDelta(-3, 'WAIST', i18n.t)).toBe('−3 см')
		expect(formatMeasurementDelta(-1.5, 'WAIST', i18n.t)).toBe('−1,5 см')
	})
})
