import { describe, expect, it } from 'vitest'

import {
	APP_CONTEXT_HEADER,
	buildFoodParseMessages,
	type DayContext,
	formatContext,
	type FoodParseContext,
	formatMeasurements,
	type RecentMeasurementContext,
} from './context.js'
import {
	DAY_HISTORY_MAX_TOKENS,
	DAY_HISTORY_TRIM_STEP_TOKENS,
	HISTORY_CHARS_PER_TOKEN,
	type HistoryTurn,
	PHOTO_HISTORY_MARKER,
	PREVIOUS_DAY_TAIL_MAX_TOKENS,
	selectDayHistory,
	selectPreviousDayTail,
	toHistoryText,
} from './day-history.js'
import type { TodayEntryContext } from './edit-context.js'

describe('formatMeasurements', () => {
	it('lists the last weights, the waist and the target', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [
					{ value: 82.8, localDate: '2026-10-05' },
					{ value: 83.1, localDate: '2026-09-29' },
				],
				waist: { value: 94, localDate: '2026-10-01' },
				targetWeightKg: 78,
			}),
		).toBe(
			'Weight: 82.8 kg on 2026-10-05; 83.1 kg on 2026-09-29. Waist: 94 cm on 2026-10-01. Target weight: 78 kg.',
		)
	})

	it('says so when nothing is logged and skips the missing parts', () => {
		expect(
			formatMeasurements({ today: '2026-10-07', weights: [], waist: null, targetWeightKg: null }),
		).toBe('Weight: none logged.')
	})
})

describe('formatMeasurements parts', () => {
	it('shows the waist and the target even without any weight', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [],
				waist: { value: 94, localDate: '2026-10-01' },
				targetWeightKg: 78,
			}),
		).toBe('Weight: none logged. Waist: 94 cm on 2026-10-01. Target weight: 78 kg.')
	})

	it('skips the waist and the target when a weight is all there is', () => {
		expect(
			formatMeasurements({
				today: '2026-10-07',
				weights: [{ value: 82, localDate: '2026-10-06' }],
				waist: null,
				targetWeightKg: null,
			}),
		).toBe('Weight: 82 kg on 2026-10-06.')
	})
})

const baseEntry: TodayEntryContext = {
	ref: 'e1',
	name: 'Вівсянка',
	mealType: 'BREAKFAST',
	grams: 300,
	kcal: 420,
	protein: 20,
	fat: 15,
	carbs: 50,
	fiber: null,
	category: 'porridge',
	source: 'ESTIMATE',
	isEdited: false,
}

const baseContext: FoodParseContext = {
	localTime: '2026-10-07 13:20, Wednesday',
	dayTotals: { kcal: 420, protein: 20, fat: 15, carbs: 50 },
	meals: [{ type: 'BREAKFAST', kcal: 420 }],
	entries: [baseEntry],
	deletedEntries: [],
	openClarifications: [],
	goal: null,
	measurements: { today: '2026-10-07', weights: [], waist: null, targetWeightKg: null },
	memory: [],
	history: [],
}

const CHANGED_MARKER = '(changed after logging)'

describe('formatContext entries', () => {
	it('marks an entry edited after logging', () => {
		const text = formatContext({ ...baseContext, entries: [{ ...baseEntry, isEdited: true }] })
		expect(text).toContain(CHANGED_MARKER)
		expect(text).toMatch(/- e1 BREAKFAST .*\(changed after logging\)/)
	})

	it('tells the date of an entry of another day, right after its meal', () => {
		const text = formatContext({
			...baseContext,
			entries: [baseEntry, { ...baseEntry, ref: 'e2', mealType: 'DINNER', date: '2026-10-06' }],
		})
		expect(text).toContain('- e2 DINNER 2026-10-06 "Вівсянка"')
		expect(text).toContain('- e1 BREAKFAST "Вівсянка"')
	})

	it('does not mark an untouched entry', () => {
		expect(formatContext(baseContext)).not.toContain(CHANGED_MARKER)
	})

	it('marks only the edited entry among several', () => {
		const text = formatContext({
			...baseContext,
			entries: [baseEntry, { ...baseEntry, ref: 'e2', isEdited: true }],
		})
		const lines = text.split('\n')
		expect(lines.find((line) => line.startsWith('- e1 '))).not.toContain(CHANGED_MARKER)
		expect(lines.find((line) => line.startsWith('- e2 '))).toContain(CHANGED_MARKER)
	})

	it('says the listed entries are already logged with their current values', () => {
		expect(formatContext(baseContext)).toContain(
			"Today's entries — already logged, current values (refs for correct_entry / delete_entry; only these can be changed):",
		)
	})

	it('reaches the model through buildFoodParseMessages', () => {
		const messages = buildFoodParseMessages(
			{ ...baseContext, entries: [{ ...baseEntry, isEdited: true }] },
			'ще чай',
		)
		expect(JSON.stringify(messages[1])).toContain(CHANGED_MARKER)
	})
})

describe('app changes in front of the message', () => {
	const appChanges = [
		{ kind: 'deleted' as const, ref: 'e1', name: 'Борщ', localDate: '2026-11-04' },
	]
	const marker = '[in the app before this message: deleted e1 "Борщ" (04.11)]'

	it('puts the marker in front of the words of the message', () => {
		const messages = buildFoodParseMessages({ ...baseContext, appChanges }, 'чому видалив?')
		expect(messages.at(-1)).toEqual({ role: 'user', content: `${marker} чому видалив?` })
	})

	it('stands alone for a message without words', () => {
		const messages = buildFoodParseMessages({ ...baseContext, appChanges }, '')
		expect(messages.at(-1)).toEqual({ role: 'user', content: marker })
	})

	it('leaves the message as it is without changes', () => {
		const messages = buildFoodParseMessages(baseContext, 'ще чай')
		expect(messages.at(-1)).toEqual({ role: 'user', content: 'ще чай' })
	})
})

describe('history turns with what Kusik read', () => {
	const digest = (text: string): string => `read workouts 01.11–10.11: ${text}`.padEnd(200, 'x')

	it('keeps both read digests and a long reply whole', () => {
		const reads = [digest('3'), digest('4')]
		const long = 'a'.repeat(3000)
		const { messages } = selectDayHistory([
			{ role: 'user', content: 'Як мої тренування цього місяця?' },
			{ role: 'assistant', content: long, reads },
		])

		expect(messages).toHaveLength(2)
		expect(messages[1]?.content).toBe(`[Kusik: ${reads.join('; ')}] ${long}`)
	})

	it('keeps every turn of a day with short digests', () => {
		const { messages } = selectDayHistory(
			Array.from({ length: 3 }, (_, index) => [
				{ role: 'user' as const, content: `питання ${index}` },
				{
					role: 'assistant' as const,
					content: 'відповідь '.repeat(20),
					reads: ['read workouts 01.11–10.11: 3 (01.11, 05.11, 09.11); records: 09.11 "Жим" 85 kg'],
				},
			]).flat(),
		)

		expect(messages).toHaveLength(6)
		expect(
			messages.filter(({ content }) => content.startsWith('[Kusik: read workouts')),
		).toHaveLength(3)
	})
})

describe('history turns with logged entries', () => {
	const userTurn = (overrides: Partial<HistoryTurn>): HistoryTurn => ({
		role: 'user',
		content: 'вівсянка 300 г',
		...overrides,
	})

	it('starts the user turn with the logged refs marker', () => {
		expect(toHistoryText(userTurn({ loggedRefs: ['e1', 'e2'] }))).toBe(
			'[logged: e1, e2] вівсянка 300 г',
		)
	})

	it('keeps both the logged marker and the photo marker', () => {
		const text = toHistoryText(userTurn({ hasPhoto: true, loggedRefs: ['e1'] }))
		expect(text.startsWith('[logged: e1] ')).toBe(true)
		expect(text).toContain(PHOTO_HISTORY_MARKER)
		expect(text).toContain('вівсянка 300 г')
	})

	it('adds no marker without logged refs', () => {
		expect(toHistoryText(userTurn({}))).toBe('вівсянка 300 г')
		expect(toHistoryText(userTurn({ loggedRefs: [] }))).toBe('вівсянка 300 г')
	})

	it('marks a turn that logged entries without refs as just logged', () => {
		expect(toHistoryText(userTurn({ hasLoggedEntries: true }))).toBe('[logged] вівсянка 300 г')
	})

	it('prefers the refs over the bare flag', () => {
		expect(toHistoryText(userTurn({ hasLoggedEntries: true, loggedRefs: ['e2'] }))).toBe(
			'[logged: e2] вівсянка 300 г',
		)
	})

	it('never marks an assistant turn with the bare flag', () => {
		expect(toHistoryText({ role: 'assistant', content: 'Записано', hasLoggedEntries: true })).toBe(
			'Записано',
		)
	})

	it('never marks an assistant turn', () => {
		expect(toHistoryText({ role: 'assistant', content: 'Записано', loggedRefs: ['e1'] })).toBe(
			'Записано',
		)
	})
})

describe('the whole day in front of the context', () => {
	// ~1000 chars of Ukrainian, the proposal is in the last sentence
	const LONG_REPLY = `${'Записав борщ, вівсянку та чай. '.repeat(50)}Хочеш, запишу омлет з 3 яєць із сиром ≈ 420 ккал?`
	const pair = (index: number): HistoryTurn[] => [
		{ role: 'user', content: `питання ${index}` },
		{ role: 'assistant', content: `відповідь ${index}` },
	]
	const stripCacheControl = (value: unknown): unknown =>
		JSON.parse(
			JSON.stringify(value, (key, item: unknown) => (key === 'cache_control' ? undefined : item)),
		)
	const countBreakpoints = (value: unknown): number =>
		(JSON.stringify(value).match(/"cache_control"/g) ?? []).length

	it('keeps a long reply of Kusik whole, with the proposal at its end', () => {
		expect(LONG_REPLY.length).toBeGreaterThan(1500)
		const messages = buildFoodParseMessages(
			{
				...baseContext,
				history: [
					{ role: 'user', content: 'що з`їв?' },
					{ role: 'assistant', content: LONG_REPLY },
				],
			},
			'так',
		)
		expect(JSON.stringify(messages)).toContain('омлет з 3 яєць із сиром ≈ 420 ккал?')
		expect(messages[2]).toEqual({
			role: 'assistant',
			content: [{ type: 'text', text: LONG_REPLY, cache_control: { type: 'ephemeral' } }],
		})
	})

	it('orders the prompt, the day before, the day, the context and the message', () => {
		const messages = buildFoodParseMessages(
			{
				...baseContext,
				previousDayHistory: [
					{ role: 'user', content: 'вчора вечір' },
					{ role: 'assistant', content: 'вчора відповідь' },
				],
				history: pair(1),
			},
			'ще чай',
		)
		expect(messages.map(({ role }) => role)).toEqual([
			'system',
			'user',
			'assistant',
			'user',
			'assistant',
			'user',
			'user',
		])
		expect(JSON.stringify(messages[1])).toContain('вчора вечір')
		expect(JSON.stringify(messages[3])).toContain('питання 1')
		const context = messages.at(-2)
		expect(context?.role).toBe('user')
		expect(
			typeof context?.content === 'string' && context.content.startsWith(APP_CONTEXT_HEADER),
		).toBe(true)
		expect(messages.at(-1)).toEqual({ role: 'user', content: 'ще чай' })
	})

	it('sets the history breakpoint on the last history message only', () => {
		const messages = buildFoodParseMessages(
			{ ...baseContext, history: [...pair(1), ...pair(2)] },
			'ще',
		)
		const withBreakpoint = messages.flatMap((message, index) =>
			JSON.stringify(message).includes('cache_control') ? [index] : [],
		)
		expect(withBreakpoint).toEqual([0, 4])
	})

	it('has one breakpoint without any history', () => {
		expect(countBreakpoints(buildFoodParseMessages(baseContext, 'привіт'))).toBe(1)
	})

	it('does not change the bytes of the history between the turn k and k + 1', () => {
		const turnK = buildFoodParseMessages({ ...baseContext, history: pair(1) }, 'a')
		const turnNext = buildFoodParseMessages(
			{ ...baseContext, history: [...pair(1), ...pair(2)] },
			'b',
		)
		expect(stripCacheControl(turnNext.slice(0, 3))).toEqual(stripCacheControl(turnK.slice(0, 3)))
	})

	it('leaves the day before out once the valve has cut the day', () => {
		const big = 'x'.repeat(Math.ceil(HISTORY_CHARS_PER_TOKEN * DAY_HISTORY_MAX_TOKENS))
		const messages = buildFoodParseMessages(
			{
				...baseContext,
				previousDayHistory: pair(0),
				history: [{ role: 'user', content: big }, ...pair(1)],
			},
			'a',
		)
		expect(JSON.stringify(messages)).not.toContain('питання 0')
	})
})

describe('selectDayHistory', () => {
	const sized = (tokens: number): string => 'x'.repeat(Math.ceil(tokens * HISTORY_CHARS_PER_TOKEN))
	const turns = (count: number, tokensEach: number): HistoryTurn[] =>
		Array.from({ length: count }, (_, index) => ({
			role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
			content: `${index} ${sized(tokensEach)}`,
		}))

	it('keeps a day under the valve whole', () => {
		const selection = selectDayHistory(turns(20, 500))
		expect(selection.messages).toHaveLength(20)
		expect(selection.droppedCount).toBe(0)
		expect(selection.isTrimmed).toBe(false)
	})

	it('drops the oldest whole messages above the valve, keeps a user first and the last message', () => {
		const all = turns(50, 500)
		const selection = selectDayHistory(all)
		expect(selection.isTrimmed).toBe(true)
		expect(selection.droppedCount).toBeGreaterThan(0)
		expect(selection.messages[0]?.role).toBe('user')
		expect(selection.messages.at(-1)?.content).toBe(all.at(-1)?.content)
		expect(selection.tokens).toBeLessThanOrEqual(DAY_HISTORY_MAX_TOKENS)
		// whole messages, never cut
		expect(selection.messages.every(({ content }) => content.length > sized(500).length)).toBe(true)
	})

	it('moves the cut by blocks: a new pair does not move it, a new block does', () => {
		const dropped = (count: number): number => selectDayHistory(turns(count, 500)).droppedCount
		// 42 messages = 21 000 tokens: 1 000 over, the first block of 5 000 goes
		expect(dropped(42)).toBe(dropped(44))
		expect(dropped(42)).toBe(dropped(46))
		// 54 messages = 27 000: 7 000 over, two blocks
		expect(dropped(54)).toBeGreaterThan(dropped(46))
		expect(DAY_HISTORY_TRIM_STEP_TOKENS).toBe(5000)
	})
})

describe('selectPreviousDayTail', () => {
	const sized = (tokens: number): string => 'x'.repeat(Math.ceil(tokens * HISTORY_CHARS_PER_TOKEN))

	it('takes at most 6 whole messages from the end', () => {
		const all: HistoryTurn[] = Array.from({ length: 10 }, (_, index) => ({
			role: index % 2 === 0 ? 'user' : 'assistant',
			content: `m${index}`,
		}))
		expect(
			selectPreviousDayTail(all, { isDayTrimmed: false }).map(({ content }) => content),
		).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9'])
	})

	it('stops at the first message that does not fit and never cuts one', () => {
		const tail = selectPreviousDayTail(
			[
				{ role: 'user', content: 'старе' },
				{ role: 'assistant', content: sized(PREVIOUS_DAY_TAIL_MAX_TOKENS + 10) },
				{ role: 'user', content: 'останнє питання' },
				{ role: 'assistant', content: 'остання відповідь' },
			],
			{ isDayTrimmed: false },
		)
		expect(tail.map(({ content }) => content)).toEqual(['останнє питання', 'остання відповідь'])
	})

	it('is empty when there is no user message to start with', () => {
		expect(
			selectPreviousDayTail([{ role: 'assistant', content: 'Привіт' }], { isDayTrimmed: false }),
		).toEqual([])
		expect(selectDayHistory([{ role: 'assistant', content: 'Привіт' }]).messages).toEqual([])
	})

	it('is empty once the valve has cut the day', () => {
		expect(selectPreviousDayTail([{ role: 'user', content: 'a' }], { isDayTrimmed: true })).toEqual(
			[],
		)
	})

	it('marks photo turns, with and without words, and never carries the image', () => {
		const tail = selectPreviousDayTail(
			[
				{ role: 'user', content: '', hasPhoto: true },
				{ role: 'assistant', content: 'Записав' },
				{ role: 'user', content: '150 г', hasPhoto: true },
			],
			{ isDayTrimmed: false },
		)
		expect(tail).toEqual([
			{ role: 'user', content: '[фото]' },
			{ role: 'assistant', content: 'Записав' },
			{ role: 'user', content: '[фото] 150 г' },
		])
	})
})

describe('formatContext days and recent measurements', () => {
	const context: FoodParseContext = {
		localTime: '2026-10-07 13:20, Wednesday',
		dayTotals: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
		meals: [],
		entries: [],
		deletedEntries: [],
		openClarifications: [],
		goal: null,
		measurements: { today: '2026-10-07', weights: [], waist: null, targetWeightKg: null },
		memory: [],
		history: [],
	}
	const days: DayContext[] = [
		{ localDate: '2026-10-04', label: null, kcal: 0, overKcal: null, entryCount: 0 },
		{ localDate: '2026-10-05', label: null, kcal: 1950, overKcal: null, entryCount: 5 },
		{ localDate: '2026-10-06', label: 'yesterday', kcal: 2310, overKcal: 110, entryCount: 6 },
		{ localDate: '2026-10-07', label: 'today', kcal: 800, overKcal: null, entryCount: 3 },
		{ localDate: '2026-10-08', label: 'tomorrow', kcal: 525, overKcal: null, entryCount: 2 },
	]

	it('renders Days: no total for today, planned for tomorrow, nothing logged for empty days', () => {
		expect(formatContext({ ...context, days })).toContain(
			'Days: 2026-10-04 Sun: nothing logged; 2026-10-05 Mon: 1950 kcal; 2026-10-06 Tue (yesterday): 2310 kcal, over the goal by 110; 2026-10-07 Wed (today); 2026-10-08 Thu (tomorrow): 525 kcal planned.',
		)
	})

	it('says nothing logged for an empty tomorrow', () => {
		const empty = days.map((day) =>
			day.label === 'tomorrow' ? { ...day, kcal: 0, entryCount: 0 } : day,
		)
		expect(formatContext({ ...context, days: empty })).toContain(
			'2026-10-08 Thu (tomorrow): nothing logged.',
		)
	})

	it('renders recent measurements of both kinds', () => {
		const recent: RecentMeasurementContext[] = [
			{ kind: 'WEIGHT', localDate: '2026-10-06', value: 82.4 },
			{ kind: 'WAIST', localDate: '2026-10-05', value: 94 },
		]
		expect(
			formatContext({ ...context, measurements: { ...context.measurements, recent } }),
		).toContain('Recent measurements: WEIGHT 2026-10-06 82.4; WAIST 2026-10-05 94.')
	})

	it('adds no line when the lists are missing or empty', () => {
		const empty = { ...context, days: [], measurements: { ...context.measurements, recent: [] } }
		expect(formatContext(empty)).toBe(formatContext(context))
		expect(formatContext(empty)).not.toContain('Days:')
		expect(formatContext(empty)).not.toContain('Recent measurements')
	})
})

describe('formatContext program', () => {
	it('adds «Program» only with a program, the rules flag or the onboarding', () => {
		expect(formatContext(baseContext)).not.toContain('# Program')
		expect(formatContext({ ...baseContext, hasProgramRules: true })).toContain('# Program')
		expect(
			formatContext({
				...baseContext,
				program: { mode: 'ROTATE', perWeek: null, title: null, nextRef: null, templates: [] },
			}),
		).toContain('Active: ROTATE.')
	})
})
