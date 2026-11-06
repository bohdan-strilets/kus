import type {
	HistoryFactMarker,
	HistoryLogMarker,
	HistoryMarkerFields,
	HistoryMeasurementMarker,
	HistorySavedFoodMarker,
} from '@kus/shared'

import { MeasurementKind } from '../../generated/prisma/client'

/** A row a user message wrote, and whether it was deleted since. */
interface SourceRow {
	id: string
	deletedAt: Date | null
}

export interface HistoryMarkerSources {
	/** Workouts the message started. */
	workouts: (SourceRow & { sourceMessageId: string | null })[]
	/** Workout id → `w1…` of this request's «Today's workouts» and deleted ones. */
	workoutRefById: ReadonlyMap<string, string>
	measurements: { kind: MeasurementKind; messageId: string | null; deletedAt: Date | null }[]
	facts: (SourceRow & {
		status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED'
		sourceMessageId: string | null
		confirmedMessageId: string | null
		answeredAt: Date | null
	})[]
	/** Fact id → `f1…` of this request's «User facts». */
	factRefById: ReadonlyMap<string, string>
	/** Message id → how many facts the model forgot in it. */
	forgottenCountByMessageId: ReadonlyMap<string, number>
	savedFoods: (SourceRow & { sourceMessageId: string | null })[]
	/** Saved food id → `m1…` of this request's «Saved foods». */
	foodRefById: ReadonlyMap<string, string>
}

const getRefNumber = (ref: string): number => Number(ref.slice(1))

/** Refs in the order the context numbers them. */
export const sortRefs = (refs: string[]): string[] =>
	[...refs].sort((a, b) => getRefNumber(a) - getRefNumber(b))

const toWorkoutMarker = (
	messageId: string,
	{ workouts, workoutRefById }: HistoryMarkerSources,
): HistoryLogMarker | undefined => {
	const own = workouts.filter(({ sourceMessageId }) => sourceMessageId === messageId)
	if (own.length === 0) return undefined
	const withRefs = own.flatMap((workout) => {
		const ref = workoutRefById.get(workout.id)
		return ref === undefined ? [] : [{ ref, isDeleted: workout.deletedAt !== null }]
	})
	return {
		refs: sortRefs(withRefs.map(({ ref }) => ref)),
		deletedRefs: sortRefs(withRefs.filter(({ isDeleted }) => isDeleted).map(({ ref }) => ref)),
		isDeleted: own.every(({ deletedAt }) => deletedAt !== null),
	}
}

const MEASUREMENT_MARKER_KINDS: [MeasurementKind, HistoryMeasurementMarker['kind']][] = [
	[MeasurementKind.WEIGHT, 'weight'],
	[MeasurementKind.WAIST, 'waist'],
]

const toMeasurementMarkers = (
	messageId: string,
	{ measurements }: HistoryMarkerSources,
): HistoryMeasurementMarker[] =>
	MEASUREMENT_MARKER_KINDS.flatMap(([kind, markerKind]) => {
		const own = measurements.filter((row) => row.messageId === messageId && row.kind === kind)
		if (own.length === 0) return []
		return [{ kind: markerKind, isDeleted: own.every(({ deletedAt }) => deletedAt !== null) }]
	})

const toFactMarkers = (
	messageId: string,
	{ facts, factRefById, forgottenCountByMessageId }: HistoryMarkerSources,
): HistoryFactMarker[] => {
	const forgotten = Array.from(
		{ length: forgottenCountByMessageId.get(messageId) ?? 0 },
		(): HistoryFactMarker => ({ kind: 'forgotten' }),
	)
	// the turn that proposed a fact and the one whose words confirmed it both say «saved»
	const own = facts.filter(
		(fact) => fact.sourceMessageId === messageId || fact.confirmedMessageId === messageId,
	)
	const marked = own.flatMap((fact): HistoryFactMarker[] => {
		const isDeleted = fact.deletedAt !== null
		if (fact.status === 'CONFIRMED') {
			return [
				{ kind: 'saved', ref: isDeleted ? null : (factRefById.get(fact.id) ?? null), isDeleted },
			]
		}
		// a rejected proposal that was never answered was replaced by a newer one
		return [
			{ kind: 'proposed', isDeclined: fact.status === 'REJECTED' && fact.answeredAt !== null },
		]
	})
	return [...forgotten, ...marked]
}

const toSavedFoodMarkers = (
	messageId: string,
	{ savedFoods, foodRefById }: HistoryMarkerSources,
): HistorySavedFoodMarker[] =>
	savedFoods
		.filter(({ sourceMessageId }) => sourceMessageId === messageId)
		.map(({ id, deletedAt }) => ({
			ref: deletedAt === null ? (foodRefById.get(id) ?? null) : null,
			isDeleted: deletedAt !== null,
		}))

/** The markers of a user message besides its food entries; a kind with nothing to say is absent. */
export const buildHistoryMarkers = (
	messageId: string,
	sources: HistoryMarkerSources,
): HistoryMarkerFields => {
	const workout = toWorkoutMarker(messageId, sources)
	const measurements = toMeasurementMarkers(messageId, sources)
	const facts = toFactMarkers(messageId, sources)
	const savedFoods = toSavedFoodMarkers(messageId, sources)
	return {
		...(workout ? { workout } : {}),
		...(measurements.length > 0 ? { measurements } : {}),
		...(facts.length > 0 ? { facts } : {}),
		...(savedFoods.length > 0 ? { savedFoods } : {}),
	}
}
