import { NO_MEMORY_ACTIONS } from '@kus/shared'
import { vi } from 'vitest'

import type { TemplateRefIds } from '../programs/program-chat-context'
import { ChatTurnRecipesService } from './chat-turn-recipes.service'
import { ChatTurnService } from './chat-turn.service'

export const TIMEZONE = 'Europe/Warsaw'
// 14:20 on Sunday 2026-10-18 in Warsaw (UTC+2): lunch by the clock
export const NOW = new Date('2026-10-18T12:20:00Z')
export const TODAY = new Date('2026-10-18T00:00:00Z')

export const toItem = (name: string, overrides: Record<string, unknown> = {}) => ({
	name,
	grams: 100,
	quantity: null,
	kcal: 100,
	protein: 1,
	fat: 1,
	carbs: 1,
	fiber: null,
	category: 'other',
	source: 'ESTIMATE',
	confidence: 0.8,
	assumption: null,
	memoryRef: null,
	copyRef: null,
	mealType: null,
	date: null,
	...overrides,
})

export const toLogDecision = (
	items: ReturnType<typeof toItem>[],
	log: Record<string, unknown> = {},
) =>
	({
		kind: 'log',
		log: { items, mealType: null, date: null, reply: 'ok', ...log },
		clarifications: [],
		edits: { corrections: [], deletions: [], restorations: [], resolutions: [] },
		measurements: [],
		measurementDeletions: [],
		workouts: [],
		memory: NO_MEMORY_ACTIONS,
	}) as never

export const createService = () => {
	const logEntries = vi.fn().mockResolvedValue({ meals: [], entryIds: [] })
	const remove = vi.fn().mockResolvedValue([])
	const record = vi.fn().mockResolvedValue([])
	const build = vi.fn().mockResolvedValue(null)
	const close = vi.fn().mockResolvedValue({ dayCard: null, isLogged: false })
	const buildStats = vi.fn().mockResolvedValue(null)
	const completeTurn = vi.fn().mockResolvedValue({ id: 'reply-1' })
	const setDayCard = vi.fn().mockResolvedValue(undefined)
	const findActiveEntriesByIds = vi.fn().mockResolvedValue([])
	const recordForTurn = vi.fn()
	const logWorkouts = vi.fn().mockResolvedValue({ sourceMessageIds: [], hasNewRecord: false })
	const buildProposalCard = vi.fn().mockResolvedValue({ status: 'UNCHANGED' })
	const resolveTemplateIds = vi.fn().mockResolvedValue(new Set())
	const getActiveView = vi.fn().mockResolvedValue(null)
	const markUsed = vi.fn().mockResolvedValue(undefined)
	const service = new ChatTurnService(
		{ $transaction: (callback: (tx: unknown) => unknown) => callback({}) } as never,
		{ completeTurn, setDayCard } as never,
		{ createClarification: vi.fn() } as never,
		{ applyEdits: vi.fn().mockResolvedValue({ sourceMessageIds: [], replyIds: [] }) } as never,
		{ logEntries, findActiveEntriesByIds } as never,
		{ markUsed: vi.fn() } as never,
		{ remove, record } as never,
		{ recordForTurn } as never,
		{ build } as never,
		{ close } as never,
		{ build: buildStats } as never,
		{ logWorkouts } as never,
		{ apply: vi.fn() } as never,
		{ buildProposalCard, resolveTemplateIds } as never,
		{ getActiveView } as never,
		{ storeAnswer: vi.fn(), offerAfterWorkout: vi.fn() } as never,
		new ChatTurnRecipesService({ markUsed } as never, {} as never),
	)
	const save = (
		decision: never,
		copyRefIds: Map<string, string> = new Map(),
		templateRefIds?: TemplateRefIds,
		requestStatsAdvice?: (card: never, deadlineMs: number) => Promise<string | null>,
		turnStartedAt?: number,
		recipes?: Map<string, unknown>,
	) =>
		service.saveDecision(
			{
				userId: 'u1',
				timezone: TIMEZONE,
				message: { id: 'm1' } as never,
				now: NOW,
				localDate: TODAY,
			},
			decision,
			{
				memory: { byRef: new Map(), context: [] },
				refIds: {},
				copyRefIds,
				...(templateRefIds ? { templateRefIds } : {}),
				...(requestStatsAdvice ? { requestStatsAdvice } : {}),
				...(turnStartedAt === undefined ? {} : { turnStartedAt }),
				...(recipes ? { recipes } : {}),
			} as never,
		)
	return {
		save,
		markUsed,
		logEntries,
		remove,
		record,
		build,
		completeTurn,
		close,
		buildStats,
		setDayCard,
		findActiveEntriesByIds,
		recordForTurn,
		buildProposalCard,
		resolveTemplateIds,
		getActiveView,
		logWorkouts,
	}
}

export const getLogged = (logEntries: ReturnType<typeof vi.fn>) => {
	const params: unknown = logEntries.mock.calls[0]?.[0]
	return params as {
		entries: { mealType: string; localDate: Date; entry: Record<string, unknown> }[]
		getEatenAt: (meal: { type: string; localDate: Date }) => Date
	}
}
