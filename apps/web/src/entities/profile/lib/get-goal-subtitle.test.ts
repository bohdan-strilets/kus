import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { getGoalSubtitle } from './get-goal-subtitle'

const t = i18n.t.bind(i18n)

describe('getGoalSubtitle', () => {
	it('names the goal in lower case and the day it started', () => {
		expect(getGoalSubtitle({ goalType: 'LOSE', createdAt: '2026-09-05T10:00:00.000Z' }, t)).toBe(
			'Ціль: схуднути · з 5 вересня',
		)
	})

	it('says so when there is no goal yet', () => {
		expect(getGoalSubtitle({ goalType: null, createdAt: '2026-09-05T10:00:00.000Z' }, t)).toBe(
			'Ціль не вказана · з 5 вересня',
		)
	})
})
