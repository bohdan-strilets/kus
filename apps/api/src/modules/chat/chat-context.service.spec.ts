import { describe, expect, it, vi } from 'vitest'

import { MessageRole } from '../../generated/prisma/client'
import { ChatContextService } from './chat-context.service'

const TODAY = new Date('2026-10-18T00:00:00Z')

const toEntry = (id: string, sourceMessageId: string | null, localDate = TODAY) => ({
	id,
	sourceMessageId,
	name: id,
	grams: 100,
	kcal: 100,
	proteinG: 1,
	fatG: 1,
	carbsG: 1,
	fiberG: 0,
	category: 'OTHER',
	source: 'ESTIMATE',
	isEdited: false,
	meal: { type: 'LUNCH', localDate },
})

const toUserMessage = (id: string, content: string) => ({
	id,
	role: MessageRole.USER,
	content,
	attachments: [],
})

const toMeasurement = (kind: string, localDate: string, value: number) => ({
	kind,
	localDate: new Date(`${localDate}T00:00:00Z`),
	value,
})

interface Mocks {
	editable?: unknown
	history?: unknown[]
	daysKcal?: Map<string, { kcal: number; entryCount: number }>
	goalKcal?: Map<string, number | null>
	range?: Record<string, unknown[]>
}

const createService = ({
	editable = { active: [], deleted: [], sourceMessages: [] },
	history = [],
	daysKcal = new Map(),
	goalKcal = new Map(),
	range = {},
}: Mocks = {}) => {
	const getEditableEntries = vi.fn().mockResolvedValue(editable)
	const getDaysKcal = vi.fn().mockResolvedValue(daysKcal)
	const findInRange = vi
		.fn()
		.mockImplementation(({ kind }: { kind: string }) => Promise.resolve(range[kind] ?? []))
	const service = new ChatContextService(
		{ findHistory: vi.fn().mockResolvedValue(history) } as never,
		{ findOpenClarifications: vi.fn().mockResolvedValue([]) } as never,
		{
			getDaySummary: vi.fn().mockResolvedValue({ totals: {}, meals: [] }),
			getEditableEntries,
			getDaysKcal,
		} as never,
		{
			getGoalForDate: vi.fn().mockResolvedValue(null),
			getGoalKcalByDay: vi.fn().mockResolvedValue(goalKcal),
		} as never,
		{
			findRecent: vi.fn().mockResolvedValue([]),
			findLatest: vi.fn().mockResolvedValue(null),
			findInRange,
		} as never,
		{ findTargetWeightKg: vi.fn().mockResolvedValue(null) } as never,
	)
	return { service, getEditableEntries, getDaysKcal, findInRange }
}

const build = (service: ChatContextService) =>
	service.buildContext({
		userId: 'u1',
		timezone: 'Europe/Warsaw',
		message: toUserMessage('m3', 'ще') as never,
		now: new Date('2026-10-18T10:00:00Z'),
		localDate: TODAY,
		memory: [],
	})

describe('ChatContextService.buildContext history markers', () => {
	it('marks a turn logged also when its entries fell out of the context window', async () => {
		// the window holds only entry "in-window"; "out-of-window" (message m1) was trimmed away
		const { service } = createService({
			history: [toUserMessage('m2', 'чай'), toUserMessage('m1', 'борщ')],
			editable: {
				active: [toEntry('in-window', 'm2')],
				deleted: [],
				sourceMessages: [
					{ id: 'out-of-window', sourceMessageId: 'm1' },
					{ id: 'in-window', sourceMessageId: 'm2' },
				],
			},
		})

		const { context } = await build(service)

		expect(context.history).toEqual([
			{ role: 'user', content: 'борщ', hasLoggedEntries: true },
			{ role: 'user', content: 'чай', loggedRefs: ['e1'] },
		])
	})
})

describe('ChatContextService.buildContext other days', () => {
	it('fills Days for today − 3 … today + 1 from the backend totals and goals', async () => {
		const { service, getDaysKcal } = createService({
			daysKcal: new Map([['2026-10-17', { kcal: 2300, entryCount: 4 }]]),
			goalKcal: new Map([['2026-10-17', 2000]]),
		})

		const { context } = await build(service)

		expect(getDaysKcal).toHaveBeenCalledWith('u1', {
			from: new Date('2026-10-15T00:00:00Z'),
			to: new Date('2026-10-19T00:00:00Z'),
		})
		expect(context.days?.map(({ localDate, label }) => [localDate, label])).toEqual([
			['2026-10-15', null],
			['2026-10-16', null],
			['2026-10-17', 'yesterday'],
			['2026-10-18', 'today'],
			['2026-10-19', 'tomorrow'],
		])
		expect(context.days?.[2]).toMatchObject({ kcal: 2300, overKcal: 300, entryCount: 4 })
	})

	it('lists the live measurements of the last 7 days, both kinds', async () => {
		const { service, findInRange } = createService({
			range: {
				WEIGHT: [toMeasurement('WEIGHT', '2026-10-12', 82.4)],
				WAIST: [toMeasurement('WAIST', '2026-10-17', 94)],
			},
		})

		const { context } = await build(service)

		expect(findInRange).toHaveBeenCalledWith({
			userId: 'u1',
			kind: 'WEIGHT',
			from: new Date('2026-10-11T00:00:00Z'),
			to: TODAY,
		})
		expect(context.measurements.recent).toEqual([
			{ kind: 'WEIGHT', localDate: '2026-10-12', value: 82.4 },
			{ kind: 'WAIST', localDate: '2026-10-17', value: 94 },
		])
	})

	it('asks for entries of the other days written since the start of the user day', async () => {
		const { service, getEditableEntries } = createService({
			editable: {
				active: [
					toEntry('today', 'm1'),
					toEntry('yesterday', 'm2', new Date('2026-10-17T00:00:00Z')),
				],
				deleted: [],
				sourceMessages: [],
			},
		})

		const { context } = await build(service)

		expect(getEditableEntries).toHaveBeenCalledWith('u1', TODAY, {
			from: new Date('2026-10-15T00:00:00Z'),
			to: new Date('2026-10-19T00:00:00Z'),
			// 00:00 on Oct 18 in Warsaw (UTC+2)
			createdSince: new Date('2026-10-17T22:00:00Z'),
		})
		expect(context.entries.map(({ ref, date }) => [ref, date])).toEqual([
			['e1', undefined],
			['e2', '2026-10-17'],
		])
	})
})
