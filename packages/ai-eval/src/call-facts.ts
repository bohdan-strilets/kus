import { measurementKindSchema, type RawToolCall, statsDaysSchema } from '@kus/shared'
import { z } from 'zod'

import type { CallFacts } from './eval.types.js'

// Narrow schemas of just what the cases judge, read from the raw tool arguments: the harness does not
// depend on the shared input types, so a model that ignores a newer contract field simply shows null.
const optionalDate = z.iso.date().nullable().optional()

const logFoodFactsSchema = z.object({
	date: optionalDate,
	items: z.array(z.object({ name: z.string(), date: optionalDate })).default([]),
})
const showDayFactsSchema = z.object({ date: optionalDate })
const deleteMeasurementFactsSchema = z.object({ kind: measurementKindSchema, date: optionalDate })
const closeDayFactsSchema = z.object({
	date: optionalDate,
	estimatedTotalKcal: z.number().nullable().optional(),
})
const showStatsFactsSchema = z.object({ days: statsDaysSchema, endDate: optionalDate })

export const EMPTY_CALL_FACTS: CallFacts = {
	logDate: null,
	itemDates: [],
	dayCards: [],
	deletedMeasurements: [],
	closeDays: [],
	statsCards: [],
}

const parseArguments = (text: string): unknown => {
	try {
		return JSON.parse(text) as unknown
	} catch {
		// broken arguments already failed validation; nothing to read from them
		return null
	}
}

/** The days the model named in its tool calls; a missing date means the case's `today`. */
export const getCallFacts = (rawCalls: RawToolCall[], today: string): CallFacts => {
	const facts: CallFacts = {
		...EMPTY_CALL_FACTS,
		itemDates: [],
		dayCards: [],
		deletedMeasurements: [],
		closeDays: [],
		statsCards: [],
	}
	for (const call of rawCalls) {
		const args = parseArguments(call.arguments)
		if (call.name === 'log_food') {
			const parsed = logFoodFactsSchema.safeParse(args)
			if (!parsed.success) continue
			facts.logDate ??= parsed.data.date ?? today
			for (const item of parsed.data.items) {
				facts.itemDates.push({ name: item.name, date: item.date ?? parsed.data.date ?? today })
			}
		}
		if (call.name === 'show_day') {
			const parsed = showDayFactsSchema.safeParse(args)
			if (parsed.success) facts.dayCards.push({ date: parsed.data.date ?? today })
		}
		if (call.name === 'delete_measurement') {
			const parsed = deleteMeasurementFactsSchema.safeParse(args)
			if (parsed.success) {
				facts.deletedMeasurements.push({ kind: parsed.data.kind, date: parsed.data.date ?? today })
			}
		}
		if (call.name === 'close_day') {
			const parsed = closeDayFactsSchema.safeParse(args)
			if (parsed.success) {
				facts.closeDays.push({
					date: parsed.data.date ?? today,
					estimatedTotalKcal: parsed.data.estimatedTotalKcal ?? null,
				})
			}
		}
		if (call.name === 'show_stats') {
			const parsed = showStatsFactsSchema.safeParse(args)
			if (parsed.success) {
				facts.statsCards.push({ days: parsed.data.days, endDate: parsed.data.endDate ?? null })
			}
		}
	}
	return facts
}
