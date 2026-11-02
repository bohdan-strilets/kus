import { describe, expect, it } from 'vitest'

import { getCardioType, TREADMILL_WALK_MAX_KMH, type CardioType } from './cardio-type.js'

describe('getCardioType', () => {
	it.each<[string, CardioType]>([
		['Біг', 'RUN'],
		['Бег на улице', 'RUN'],
		['Running', 'RUN'],
		['Jogging', 'RUN'],
		['Ходьба', 'WALK'],
		['Walking', 'WALK'],
		['Велосипед', 'BIKE'],
		['Велотренажер', 'BIKE'],
		['Cycling', 'BIKE'],
		['Spinning', 'BIKE'],
		['Гребля', 'ROW'],
		['Гребний тренажер', 'ROW'],
		['Rowing machine', 'ROW'],
		['Еліптичний тренажер', 'ELLIPTICAL'],
		['Эллиптический тренажер', 'ELLIPTICAL'],
		['Elliptical', 'ELLIPTICAL'],
		['Степер', 'STAIRS'],
		['Сходи', 'STAIRS'],
		['Stair climber', 'STAIRS'],
		['Скакалка', 'ROPE'],
		['Jump rope', 'ROPE'],
		['Плавання', 'SWIM'],
		['Swimming', 'SWIM'],
		['Йога', 'OTHER'],
		['Кардіо', 'OTHER'],
		['', 'OTHER'],
	])('%s -> %s', (name, expected) => {
		expect(getCardioType(name)).toBe(expected)
	})

	it('is case- and punctuation-insensitive', () => {
		expect(getCardioType('  БІГ!!! ')).toBe('RUN')
		expect(getCardioType('SWIMMING')).toBe('SWIM')
	})

	it('matches word prefixes only, not substrings', () => {
		expect(getCardioType('Throw')).toBe('OTHER')
		expect(getCardioType('Prerun')).toBe('OTHER')
	})

	it('requires every stem of a multi-stem alternative', () => {
		expect(getCardioType('Jump')).toBe('OTHER')
		expect(getCardioType('Rope')).toBe('OTHER')
	})

	describe('treadmill', () => {
		it('is a run without a speed', () => {
			expect(getCardioType('Доріжка')).toBe('RUN')
			expect(getCardioType('Treadmill')).toBe('RUN')
			expect(getCardioType('Treadmill', { speedKmh: null })).toBe('RUN')
		})

		it('is a walk below the threshold', () => {
			expect(getCardioType('Бігова доріжка', { speedKmh: 5 })).toBe('WALK')
			expect(getCardioType('Treadmill', { speedKmh: TREADMILL_WALK_MAX_KMH - 0.1 })).toBe('WALK')
			expect(getCardioType('Дорожка', { speedKmh: 0 })).toBe('WALK')
		})

		it('is a run at the threshold and above', () => {
			expect(getCardioType('Доріжка', { speedKmh: TREADMILL_WALK_MAX_KMH })).toBe('RUN')
			expect(getCardioType('Treadmill', { speedKmh: 12 })).toBe('RUN')
		})
	})

	it('does not turn a non-treadmill run into a walk by speed', () => {
		expect(getCardioType('Біг', { speedKmh: 4 })).toBe('RUN')
	})

	it('does not change other types by speed', () => {
		expect(getCardioType('Велосипед', { speedKmh: 2 })).toBe('BIKE')
	})

	describe('rule priority', () => {
		it('swim wins over run', () => {
			expect(getCardioType('Плавання і біг')).toBe('SWIM')
		})

		it('stairs win over run', () => {
			expect(getCardioType('Біг по сходи')).toBe('STAIRS')
		})

		it('rope wins over row', () => {
			expect(getCardioType('Jump rope row')).toBe('ROPE')
		})

		it('walk on a treadmill is a walk at any speed', () => {
			expect(getCardioType('Ходьба по доріжці', { speedKmh: 10 })).toBe('WALK')
			expect(getCardioType('Walk on treadmill')).toBe('WALK')
		})

		it('bike wins over walk', () => {
			expect(getCardioType('Велосипед і ходьба')).toBe('BIKE')
		})
	})
})
