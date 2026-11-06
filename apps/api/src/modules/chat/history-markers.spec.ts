import { describe, expect, it } from 'vitest'

import { MeasurementKind } from '../../generated/prisma/client'
import { buildHistoryMarkers, type HistoryMarkerSources, sortRefs } from './history-markers'

// Contract: buildHistoryMarkers(messageId, sources) -> markers of the kinds besides food
//  - a kind with nothing to say is absent (undefined), never an empty array
//  - refs come from the maps of this request; a row without a ref is still a marker, without one
const MESSAGE = 'm1'
const NOW = new Date('2026-11-06T10:00:00Z')

const NO_MARKER_SOURCES: HistoryMarkerSources = {
	workouts: [],
	workoutRefById: new Map(),
	measurements: [],
	facts: [],
	factRefById: new Map(),
	forgottenCountByMessageId: new Map(),
	savedFoods: [],
	foodRefById: new Map(),
}

const sources = (overrides: Partial<HistoryMarkerSources>): HistoryMarkerSources => ({
	...NO_MARKER_SOURCES,
	...overrides,
})

const fact = (
	overrides: Partial<HistoryMarkerSources['facts'][number]>,
): HistoryMarkerSources['facts'][number] => ({
	id: 'fact-1',
	status: 'CONFIRMED',
	deletedAt: null,
	sourceMessageId: MESSAGE,
	confirmedMessageId: null,
	answeredAt: null,
	...overrides,
})

describe('sortRefs', () => {
	it('orders by the number, not the text', () => {
		expect(sortRefs(['w10', 'w2', 'w1'])).toEqual(['w1', 'w2', 'w10'])
	})
})

describe('buildHistoryMarkers', () => {
	it('is empty for a message that did nothing', () => {
		expect(buildHistoryMarkers(MESSAGE, NO_MARKER_SOURCES)).toEqual({})
	})

	it('ignores rows of other messages', () => {
		const result = buildHistoryMarkers(
			MESSAGE,
			sources({
				workouts: [{ id: 'w', sourceMessageId: 'm2', deletedAt: null }],
				measurements: [{ kind: MeasurementKind.WEIGHT, messageId: 'm2', deletedAt: null }],
				facts: [fact({ sourceMessageId: 'm2' })],
				savedFoods: [{ id: 'food', sourceMessageId: 'm2', deletedAt: null }],
			}),
		)
		expect(result).toEqual({})
	})

	describe('workout', () => {
		it('shows the w-ref of the workout', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					workouts: [{ id: 'w-a', sourceMessageId: MESSAGE, deletedAt: null }],
					workoutRefById: new Map([['w-a', 'w1']]),
				}),
			)
			expect(result.workout).toEqual({ refs: ['w1'], deletedRefs: [], isDeleted: false })
		})

		it('names the ref of a deleted workout of the deleted list', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					workouts: [{ id: 'w-a', sourceMessageId: MESSAGE, deletedAt: NOW }],
					workoutRefById: new Map([['w-a', 'w1']]),
				}),
			)
			expect(result.workout).toEqual({ refs: ['w1'], deletedRefs: ['w1'], isDeleted: true })
		})

		it('has no ref when the context does not list the workout', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ workouts: [{ id: 'w-a', sourceMessageId: MESSAGE, deletedAt: NOW }] }),
			)
			expect(result.workout).toEqual({ refs: [], deletedRefs: [], isDeleted: true })
		})

		it('is deleted without refs only when every workout of the turn is', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					workouts: [
						{ id: 'w-a', sourceMessageId: MESSAGE, deletedAt: NOW },
						{ id: 'w-b', sourceMessageId: MESSAGE, deletedAt: null },
					],
				}),
			)
			expect(result.workout?.isDeleted).toBe(false)
		})
	})

	describe('measurements', () => {
		it('gives WEIGHT before WAIST whatever the order of the rows', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					measurements: [
						{ kind: MeasurementKind.WAIST, messageId: MESSAGE, deletedAt: NOW },
						{ kind: MeasurementKind.WEIGHT, messageId: MESSAGE, deletedAt: null },
					],
				}),
			)
			expect(result.measurements).toEqual([
				{ kind: 'weight', isDeleted: false },
				{ kind: 'waist', isDeleted: true },
			])
		})

		it('makes one marker per kind', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					measurements: [
						{ kind: MeasurementKind.WEIGHT, messageId: MESSAGE, deletedAt: NOW },
						{ kind: MeasurementKind.WEIGHT, messageId: MESSAGE, deletedAt: null },
					],
				}),
			)
			expect(result.measurements).toEqual([{ kind: 'weight', isDeleted: false }])
		})
	})

	describe('facts', () => {
		const refs = new Map([['fact-1', 'f11']])

		it('shows a confirmed fact with its ref in the current list', () => {
			const result = buildHistoryMarkers(MESSAGE, sources({ facts: [fact({})], factRefById: refs }))
			expect(result.facts).toEqual([{ kind: 'saved', ref: 'f11', isDeleted: false }])
		})

		it('shows a confirmed fact without a ref when the list lacks it', () => {
			const result = buildHistoryMarkers(MESSAGE, sources({ facts: [fact({})] }))
			expect(result.facts).toEqual([{ kind: 'saved', ref: null, isDeleted: false }])
		})

		it('shows a deleted confirmed fact as deleted, without a ref', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [fact({ deletedAt: NOW })], factRefById: refs }),
			)
			expect(result.facts).toEqual([{ kind: 'saved', ref: null, isDeleted: true }])
		})

		it('says saved on the turn whose words confirmed the proposal, and on the one that proposed it', () => {
			const confirmed = fact({ sourceMessageId: 'm0', confirmedMessageId: MESSAGE })
			const proposing = buildHistoryMarkers(
				'm0',
				sources({ facts: [confirmed], factRefById: refs }),
			)
			const confirming = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [confirmed], factRefById: refs }),
			)
			expect(proposing.facts).toEqual([{ kind: 'saved', ref: 'f11', isDeleted: false }])
			expect(confirming.facts).toEqual([{ kind: 'saved', ref: 'f11', isDeleted: false }])
		})

		it('says saved once when one turn proposed and confirmed', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [fact({ confirmedMessageId: MESSAGE })] }),
			)
			expect(result.facts).toHaveLength(1)
		})

		it('tells a proposal waiting for an answer', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [fact({ status: 'PROPOSED' })] }),
			)
			expect(result.facts).toEqual([{ kind: 'proposed', isDeclined: false }])
		})

		it('tells a proposal declined with «Ні»', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [fact({ status: 'REJECTED', answeredAt: NOW })] }),
			)
			expect(result.facts).toEqual([{ kind: 'proposed', isDeclined: true }])
		})

		it('tells a proposal replaced by a newer one as not answered', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ facts: [fact({ status: 'REJECTED' })] }),
			)
			expect(result.facts).toEqual([{ kind: 'proposed', isDeclined: false }])
		})

		it('adds one forgotten marker for every forget call of the turn', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ forgottenCountByMessageId: new Map([[MESSAGE, 2]]) }),
			)
			expect(result.facts).toEqual([{ kind: 'forgotten' }, { kind: 'forgotten' }])
		})

		it('puts the forgotten next to the saved fact so that the formatter can merge them', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					facts: [fact({})],
					factRefById: refs,
					forgottenCountByMessageId: new Map([[MESSAGE, 1]]),
				}),
			)
			expect(result.facts).toEqual([
				{ kind: 'forgotten' },
				{ kind: 'saved', ref: 'f11', isDeleted: false },
			])
		})
	})

	describe('saved foods', () => {
		it('shows the m-ref of a food the request lists', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					savedFoods: [{ id: 'food-a', sourceMessageId: MESSAGE, deletedAt: null }],
					foodRefById: new Map([['food-a', 'm3']]),
				}),
			)
			expect(result.savedFoods).toEqual([{ ref: 'm3', isDeleted: false }])
		})

		it('has no ref for a food the request does not list', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({ savedFoods: [{ id: 'food-a', sourceMessageId: MESSAGE, deletedAt: null }] }),
			)
			expect(result.savedFoods).toEqual([{ ref: null, isDeleted: false }])
		})

		it('marks a deleted food, without a ref', () => {
			const result = buildHistoryMarkers(
				MESSAGE,
				sources({
					savedFoods: [{ id: 'food-a', sourceMessageId: MESSAGE, deletedAt: NOW }],
					foodRefById: new Map([['food-a', 'm3']]),
				}),
			)
			expect(result.savedFoods).toEqual([{ ref: null, isDeleted: true }])
		})
	})
})
