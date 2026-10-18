// @vitest-environment jsdom
import type { MeasurementCard } from '@kus/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { DeletedMeasurementRow } from './DeletedMeasurementRow'

afterEach(cleanup)

const createCard = (overrides: Partial<MeasurementCard> = {}): MeasurementCard => ({
	id: '0199b3a4-0000-7000-8000-000000000001',
	kind: 'WEIGHT',
	value: 82.4,
	localDate: '2026-10-18',
	source: 'CHAT',
	measuredAt: null,
	isDeleted: true,
	fromStart: null,
	toGoal: null,
	isGoalReached: null,
	weekChange: null,
	planPaceKgPerWeek: null,
	chart: [],
	...overrides,
})

describe('DeletedMeasurementRow', () => {
	it('says what was deleted and for which day, like the mockup', () => {
		render(<DeletedMeasurementRow card={createCard()} />)

		expect(screen.getByText('Замір 82,4 кг за 18.10 видалено.')).toBeTruthy()
	})

	it('names the waist in centimetres', () => {
		render(<DeletedMeasurementRow card={createCard({ kind: 'WAIST', value: 94 })} />)

		expect(screen.getByText('Замір 94 см за 18.10 видалено.')).toBeTruthy()
	})
})
