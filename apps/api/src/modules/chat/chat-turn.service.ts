import { Injectable, Logger } from '@nestjs/common'
import {
	type AddressForm,
	applyMemoryNotice,
	type AiFoodItem,
	type DayCard,
	type DeleteMeasurementInput,
	ENTRY_AHEAD_MAX_DAYS,
	ENTRY_BACKDATE_MAX_DAYS,
	type FoodParseDecision,
	getDayOffset,
	hasMemoryActions,
	type LogFoodInput,
	type LogMeasurementInput,
	type MemoryActions,
	type ProgramView,
	STATS_EMPTY_REPLY,
	type StatsCard,
} from '@kus/shared'

import {
	NO_WORKOUT_REFS,
	type WorkoutRefIds,
	WorkoutsTurnService,
} from '../workouts/workouts-turn.service'
import { formatDbDate, getLocalHour } from '../../common/time'
import { AttachmentStatus, MeasurementKind, type Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { AchievementsService } from '../achievements/achievements.service'
import { EntriesService } from '../entries/entries.service'
import type { EntryWithMealType } from '../entries/entries.repository'
import type { LogEntriesParams, MealEntryInput, NewFoodEntry } from '../entries/entries.types'
import { MemoryService, type RelevantFoods } from '../memory/memory.service'
import { ChatTurnMemoryService, type SavedFoodRef } from './chat-turn-memory.service'
import { ProgressStatsService } from '../progress/progress-stats.service'
import { NO_TEMPLATE_REFS, type TemplateRefIds } from '../programs/program-chat-context'
import {
	ProgramProposalsService,
	type ProposalCardResult,
} from '../programs/program-proposals.service'
import { ProgramsService } from '../programs/programs.service'
import { PROGRAM_BASE_CHANGED_REPLY, PROGRAM_UNCHANGED_REPLY } from './chat.constants'
import { ChatCloseDayService } from './chat-close-day.service'
import { ChatDayCardService } from './chat-day-card.service'
import { ChatEditsService, type EditedMessages, NO_EDITED_MESSAGES } from './chat-edits.service'
import {
	MessageInProgressException,
	TurnCopySourceMissingException,
	TurnDateOutOfRangeException,
} from './chat.exceptions'
import { ChatTurnMeasurementsService } from './chat-turn-measurements.service'
import { ChatRepository, type MessageWithAttachments } from './chat.repository'
import type { PhotoPayload } from '../../common/photo'
import { ChatTrainingOnboardingAnswersService } from './chat-training-onboarding-answers.service'
import type { OnboardingAnswer } from './training-onboarding-question'
import { ClarificationsRepository } from './clarifications.repository'
import type { EditRefIds } from './edit-context'
import type { CopyRefIds } from './history-context'
import { getMealEatenAtForDay, getMealTypeByHour } from '../entries/meal-type'

export interface TurnParams {
	userId: string
	timezone: string
	/** Gender forms of the words about the user, for the model context. */
	addressForm?: AddressForm
	message: MessageWithAttachments
	text?: string
	photo?: PhotoPayload
	now: Date
	localDate: Date
	/** The last answer of the training onboarding: stored with the turn, its five answers go to «Program». */
	onboardingAnswer?: OnboardingAnswer
}

/** What an edited turn changed, and the messages whose measurement card a new value replaced. */
export interface TurnResult extends EditedMessages {
	replacedMeasurementMessageIds: string[]
	/** Foods saved to memory by this turn; live in the response only. */
	savedFoods?: SavedFoodRef[]
	/** A workout record the sessions did not hold before this turn; live in the response only. */
	hasNewWorkoutRecord?: boolean
}

/** The memory tools of a turn and the ids their refs stand for; the parser has checked the refs. */
interface MemoryTurn {
	actions: MemoryActions
	foodsByRef: RelevantFoods['byRef']
	factIdByRef: ReadonlyMap<string, string>
}

const hasWeight = (measurements: LogMeasurementInput[]): boolean =>
	measurements.some(({ kind }) => kind === MeasurementKind.WEIGHT)

const getReplyText = (decision: FoodParseDecision): string => {
	switch (decision.kind) {
		case 'log':
			// each reply covers its own part: the food, then the workouts
			return [decision.log.reply, ...decision.workouts.map(({ reply }) => reply)].join(' ')
		case 'workout':
			return decision.workouts.map(({ reply }) => reply).join(' ')
		case 'edit':
		case 'day':
		case 'close_day':
		case 'stats':
			return decision.text
		case 'not_food':
		case 'photo_unusable':
			return decision.reply
		case 'reply':
			return decision.text
		case 'program':
			return decision.program.reply
	}
}

const getMealKey = (day: string, mealType: string): string => `${day}|${mealType}`

/** The earlier entry's values for a portion of `grams`: scaled by the backend, its provenance kept. */
const copyEntryValues = (
	entry: EntryWithMealType,
	grams: number,
): Pick<
	NewFoodEntry,
	| 'kcal'
	| 'protein'
	| 'fat'
	| 'carbs'
	| 'fiber'
	| 'category'
	| 'source'
	| 'confidence'
	| 'myFoodId'
	| 'copiedFromDate'
> => {
	const factor = grams / entry.grams
	return {
		kcal: entry.kcal * factor,
		protein: entry.proteinG * factor,
		fat: entry.fatG * factor,
		carbs: entry.carbsG * factor,
		fiber: entry.fiberG === null ? null : entry.fiberG * factor,
		category: entry.category,
		source: entry.source,
		confidence: entry.confidence,
		myFoodId: entry.myFoodId,
		copiedFromDate: entry.meal.localDate,
	}
}

const NO_FACT_REFS: ReadonlyMap<string, string> = new Map()

const toDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`)

/** Stores what the model decided for one turn: the reply, the edits, new entries and questions. */
@Injectable()
export class ChatTurnService {
	private readonly logger = new Logger(ChatTurnService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly chatRepository: ChatRepository,
		private readonly clarificationsRepository: ClarificationsRepository,
		private readonly chatEdits: ChatEditsService,
		private readonly entriesService: EntriesService,
		private readonly memoryService: MemoryService,
		private readonly turnMeasurements: ChatTurnMeasurementsService,
		private readonly achievementsService: AchievementsService,
		private readonly dayCards: ChatDayCardService,
		private readonly closeDays: ChatCloseDayService,
		private readonly progressStats: ProgressStatsService,
		private readonly workoutsTurn: WorkoutsTurnService,
		private readonly turnMemory: ChatTurnMemoryService,
		private readonly programProposals: ProgramProposalsService,
		private readonly programs: ProgramsService,
		private readonly trainingOnboarding: ChatTrainingOnboardingAnswersService,
	) {}

	async saveDecision(
		{ userId, timezone, message, photo, now, localDate, onboardingAnswer }: TurnParams,
		decision: FoodParseDecision,
		{
			memory,
			refIds,
			workoutRefIds = NO_WORKOUT_REFS,
			copyRefIds,
			factRefIds = NO_FACT_REFS,
			templateRefIds = NO_TEMPLATE_REFS,
		}: {
			memory: RelevantFoods
			refIds: EditRefIds
			/** Omitted where the turn cannot touch workouts. */
			workoutRefIds?: WorkoutRefIds
			copyRefIds: CopyRefIds
			/** `f1…` → fact ids; omitted where the context had no facts. */
			factRefIds?: ReadonlyMap<string, string>
			/** `t1…` of «Program»; omitted where the context had no program. */
			templateRefIds?: TemplateRefIds
		},
	): Promise<TurnResult> {
		// the numbers of the card are counted before the turn is written; a card is a snapshot anyway
		const dayCard = await this.buildDayCard({ userId, message, now, localDate }, decision)
		const statsCard = await this.buildStatsCard({ userId, localDate }, decision)
		const proposal = await this.buildProgramCard(userId, decision, {
			templateRefIds,
			workoutRefIds,
		})
		const programCard = proposal?.status === 'CARD' ? proposal.card : undefined
		const programView = await this.buildProgramView(userId, decision)
		const templateIds = await this.resolveTemplateIds(userId, decision, templateRefIds)
		// nothing logged in the period: the model's text would talk about a card that is not there;
		// a program that already is what the model proposed, or that changed in the editor since the
		// model saw it, gets no card and a sentence of our own
		const replyText =
			decision.kind === 'stats' && !statsCard
				? STATS_EMPTY_REPLY
				: proposal?.status === 'UNCHANGED'
					? PROGRAM_UNCHANGED_REPLY
					: proposal?.status === 'BASE_CHANGED'
						? PROGRAM_BASE_CHANGED_REPLY
						: getReplyText(decision)
		const memoryTurn: MemoryTurn | null =
			(decision.kind === 'log' || decision.kind === 'reply' || decision.kind === 'edit') &&
			hasMemoryActions(decision.memory)
				? { actions: decision.memory, foodsByRef: memory.byRef, factIdByRef: factRefIds }
				: null
		return this.prisma.$transaction(async (tx) => {
			const reply = await this.chatRepository.completeTurn(
				{
					userId,
					userMessageId: message.id,
					replyText,
					dayCard,
					statsCard,
					programCard,
					programView,
				},
				tx,
			)
			// a resend of a stale turn finished it meanwhile; roll back instead of logging food twice
			if (!reply) throw new MessageInProgressException()
			if (onboardingAnswer) await this.trainingOnboarding.storeAnswer(userId, onboardingAnswer, tx)
			if (photo) {
				await this.chatRepository.setAttachmentStatus(
					{
						userId,
						messageId: message.id,
						status:
							decision.kind === 'photo_unusable'
								? AttachmentStatus.FAILED
								: AttachmentStatus.PROCESSED,
					},
					tx,
				)
			}
			if (decision.kind === 'reply') {
				const replaced = await this.saveMeasurements(
					{ userId, timezone, message, now, localDate },
					decision,
					tx,
				)
				const savedFoods = await this.saveMemory(
					{ userId, message, replyId: reply.id, replyText, hasPhoto: photo !== undefined },
					{ memoryTurn, entryIds: [] },
					tx,
				)
				await this.achievementsService.recordForTurn(
					{
						userId,
						timezone,
						now,
						replyMessageId: reply.id,
						userMessageId: message.id,
						isFoodChanged: false,
						isWeightLogged: hasWeight(decision.measurements),
					},
					tx,
				)
				return { ...NO_EDITED_MESSAGES, replacedMeasurementMessageIds: replaced, savedFoods }
			}
			if (decision.kind === 'close_day') {
				return this.saveClosedDay(
					{ userId, timezone, message, now, localDate },
					{ decision, replyId: reply.id },
					tx,
				)
			}
			if (decision.kind === 'workout') {
				const { sourceMessageIds, hasNewRecord } = await this.workoutsTurn.logWorkouts(
					{
						userId,
						sourceMessageId: message.id,
						now,
						localDate,
						workouts: decision.workouts,
						refIds: workoutRefIds,
						templateIds,
					},
					tx,
				)
				await this.trainingOnboarding.offerAfterWorkout({ userId, replyId: reply.id }, tx)
				return {
					...NO_EDITED_MESSAGES,
					sourceMessageIds,
					replacedMeasurementMessageIds: [],
					hasNewWorkoutRecord: hasNewRecord,
				}
			}
			if (decision.kind !== 'log' && decision.kind !== 'edit') {
				return { ...NO_EDITED_MESSAGES, replacedMeasurementMessageIds: [] }
			}
			// earlier entries first: their refs describe the day before this message
			const edited = await this.chatEdits.applyEdits(
				{ userId, userMessageId: message.id, edits: decision.edits, refIds, workoutRefIds },
				tx,
			)
			if (decision.kind === 'edit') {
				const savedFoods = await this.saveMemory(
					{ userId, message, replyId: reply.id, replyText, hasPhoto: photo !== undefined },
					{ memoryTurn, entryIds: [] },
					tx,
				)
				// a restored entry can complete a streak; corrections and deletions never do
				await this.achievementsService.recordForTurn(
					{
						userId,
						timezone,
						now,
						replyMessageId: reply.id,
						userMessageId: message.id,
						isFoodChanged: decision.edits.restorations.length > 0,
						isWeightLogged: false,
					},
					tx,
				)
				return { ...edited, replacedMeasurementMessageIds: [], savedFoods }
			}

			const copies = await this.loadCopySources(
				{ userId, messageId: message.id },
				decision.log,
				copyRefIds,
				tx,
			)
			const { entries, getEatenAt } = this.planEntries({
				params: { userId, timezone, message, now, localDate },
				log: decision.log,
				memory,
				copies,
				isFromPhoto: photo !== undefined,
			})
			const { entryIds } = await this.entriesService.logEntries(
				{ userId, sourceMessageId: message.id, getEatenAt, entries },
				tx,
			)
			const usedFoodIds = [...new Set(entries.flatMap(({ entry }) => entry.myFoodId ?? []))]
			await this.memoryService.markUsed({ userId, ids: usedFoodIds, usedAt: now }, tx)
			const savedFoods = await this.saveMemory(
				{ userId, message, replyId: reply.id, replyText, hasPhoto: photo !== undefined },
				{ memoryTurn, entryIds },
				tx,
			)

			for (const clarification of decision.clarifications) {
				await this.clarificationsRepository.createClarification(
					{
						userId,
						messageId: reply.id,
						question: clarification.question,
						options: clarification.options,
						impactKcal: clarification.impactKcal,
						entryIds: clarification.itemIndexes.flatMap((index) => entryIds[index] ?? []),
					},
					tx,
				)
			}
			const workoutMessages =
				decision.workouts.length > 0
					? await this.workoutsTurn.logWorkouts(
							{
								userId,
								sourceMessageId: message.id,
								now,
								localDate,
								workouts: decision.workouts,
								refIds: workoutRefIds,
								templateIds,
							},
							tx,
						)
					: { sourceMessageIds: [], hasNewRecord: false }
			if (decision.workouts.length > 0) {
				await this.trainingOnboarding.offerAfterWorkout({ userId, replyId: reply.id }, tx)
			}
			const replaced = await this.saveMeasurements(
				{ userId, timezone, message, now, localDate },
				decision,
				tx,
			)
			await this.achievementsService.recordForTurn(
				{
					userId,
					timezone,
					now,
					replyMessageId: reply.id,
					userMessageId: message.id,
					isFoodChanged: true,
					isWeightLogged: hasWeight(decision.measurements),
				},
				tx,
			)
			// the meals it joined grew: earlier cards of them get a new «разом» line
			return {
				...edited,
				sourceMessageIds: [
					...edited.sourceMessageIds,
					...workoutMessages.sourceMessageIds,
					message.id,
				],
				replacedMeasurementMessageIds: replaced,
				savedFoods,
				hasNewWorkoutRecord: workoutMessages.hasNewRecord,
			}
		})
	}

	/**
	 * save_food, save_fact and forget_fact, after the entries they may point at. A notice (limit, a
	 * fact the guard refused) goes into the reply text in this same transaction, so the history shows it.
	 */
	private async saveMemory(
		params: {
			userId: string
			message: MessageWithAttachments
			replyId: string
			replyText: string
			hasPhoto: boolean
		},
		{ memoryTurn, entryIds }: { memoryTurn: MemoryTurn | null; entryIds: readonly string[] },
		tx: Prisma.TransactionClient,
	): Promise<SavedFoodRef[]> {
		if (!memoryTurn) return []
		const { userId, message, replyId, replyText, hasPhoto } = params
		const result = await this.turnMemory.apply(
			{
				userId,
				messageId: message.id,
				memory: memoryTurn.actions,
				foodsByRef: memoryTurn.foodsByRef,
				factIdByRef: memoryTurn.factIdByRef,
				entryIds,
				hasPhoto,
			},
			tx,
		)
		const content = result.notice === null ? replyText : applyMemoryNotice(replyText, result.notice)
		if (content !== replyText) {
			await this.chatRepository.setReplyContent({ userId, id: replyId, content }, tx)
		}
		return result.savedFoods
	}

	/** reply(attach: program) only: the active program as it is now; undefined without one. */
	private async buildProgramView(
		userId: string,
		decision: FoodParseDecision,
	): Promise<ProgramView | undefined> {
		if (decision.kind !== 'reply' || decision.attach !== 'program') return undefined
		return (await this.programs.getActiveView(userId)) ?? undefined
	}

	/** propose_program only (undefined otherwise), against the version the turn's context showed. */
	private async buildProgramCard(
		userId: string,
		decision: FoodParseDecision,
		{
			templateRefIds,
			workoutRefIds,
		}: { templateRefIds: TemplateRefIds; workoutRefIds: WorkoutRefIds },
	): Promise<ProposalCardResult | undefined> {
		if (decision.kind !== 'program') return undefined
		return this.programProposals.buildProposalCard(userId, decision.program, {
			refs: { templateKeys: templateRefIds.keys, exerciseIds: workoutRefIds.exercises },
			contextVersionId: templateRefIds.baseVersionId,
		})
	}

	/**
	 * log_workout.templateRef → the template id the turn's context gave it, only while it is still in
	 * the active version (workouts never read programs: the chat hands the checked id over).
	 */
	private async resolveTemplateIds(
		userId: string,
		decision: FoodParseDecision,
		{ ids }: TemplateRefIds,
	): Promise<ReadonlyMap<string, string>> {
		const workouts = decision.kind === 'workout' || decision.kind === 'log' ? decision.workouts : []
		const refs = [...new Set(workouts.flatMap(({ templateRef }) => templateRef ?? []))]
		const byRef = refs.flatMap((ref) => {
			const id = ids.get(ref)
			return id ? [[ref, id] as const] : []
		})
		// a t-ref of the open proposal only: no template of the active version stands behind it
		const unbound = refs.filter((ref) => !ids.has(ref))
		if (unbound.length > 0) {
			this.logger.warn(
				`Template ref not in the active program user=${userId} refs=${unbound.join(',')}`,
			)
		}
		if (byRef.length === 0) return new Map()
		const live = await this.programProposals.resolveTemplateIds(
			userId,
			byRef.map(([, id]) => id),
		)
		return new Map(byRef.filter(([, id]) => live.has(id)))
	}

	/** show_day only; null when the day is empty (the reply stays a text). */
	private async buildDayCard(
		{
			userId,
			message,
			now,
			localDate,
		}: Pick<TurnParams, 'userId' | 'message' | 'now' | 'localDate'>,
		decision: FoodParseDecision,
	): Promise<DayCard | undefined> {
		if (decision.kind !== 'day') return undefined
		const today = formatDbDate(localDate)
		const day = decision.date ?? today
		// the card is read-only, so any past day is fine (not just the logging window); only the
		// upper bound mirrors the parser, and a miss there is a bug that stops the turn
		if (getDayOffset(day, today) > ENTRY_AHEAD_MAX_DAYS) {
			this.logger.error(`Day out of range user=${userId} message=${message.id}`)
			throw new TurnDateOutOfRangeException()
		}
		return (await this.dayCards.build({ userId, localDate: day, today, now })) ?? undefined
	}

	/** show_stats only; undefined when nothing was logged in the period (the reply becomes STATS_EMPTY_REPLY). */
	private async buildStatsCard(
		{ userId, localDate }: Pick<TurnParams, 'userId' | 'localDate'>,
		decision: FoodParseDecision,
	): Promise<StatsCard | undefined> {
		if (decision.kind !== 'stats') return undefined
		const card = await this.progressStats.build({
			userId,
			days: decision.days,
			endDate: decision.endDate,
			today: formatDbDate(localDate),
		})
		return card ?? undefined
	}

	/** close_day: the gap up to the user's total is logged, then the card is written onto the reply. */
	private async saveClosedDay(
		{
			userId,
			timezone,
			message,
			now,
			localDate,
		}: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'>,
		{
			decision,
			replyId,
		}: { decision: Extract<FoodParseDecision, { kind: 'close_day' }>; replyId: string },
		tx: Prisma.TransactionClient,
	): Promise<TurnResult> {
		const { dayCard, isLogged } = await this.closeDays.close(
			{
				userId,
				messageId: message.id,
				date: decision.date,
				estimatedTotalKcal: decision.estimatedTotalKcal,
				localDate,
				timezone,
				now,
			},
			tx,
		)
		if (dayCard) await this.chatRepository.setDayCard({ userId, id: replyId, dayCard }, tx)
		if (isLogged) {
			await this.achievementsService.recordForTurn(
				{
					userId,
					timezone,
					now,
					replyMessageId: replyId,
					userMessageId: message.id,
					isFoodChanged: true,
					isWeightLogged: false,
				},
				tx,
			)
		}
		// earlier cards of the meal it joined grew: they get a new «разом» line
		return {
			...NO_EDITED_MESSAGES,
			sourceMessageIds: isLogged ? [message.id] : [],
			replacedMeasurementMessageIds: [],
		}
	}

	/**
	 * The entries a copyRef points at, read again by id and userId inside the turn: a ref is only a
	 * pointer into the context, never trusted for the values. A deleted entry is simply missing.
	 */
	private async loadCopySources(
		{ userId, messageId }: { userId: string; messageId: string },
		log: LogFoodInput,
		copyRefIds: CopyRefIds,
		tx: Prisma.TransactionClient,
	): Promise<Map<string, EntryWithMealType>> {
		const refs = [...new Set(log.items.flatMap((item) => item.copyRef ?? []))]
		const ids = refs.flatMap((ref) => copyRefIds.get(ref) ?? [])
		const entries = await this.entriesService.findActiveEntriesByIds(userId, ids, tx)
		const byId = new Map(entries.map((entry) => [entry.id, entry]))
		const copies = new Map(
			refs.flatMap((ref) => {
				const entry = byId.get(copyRefIds.get(ref) ?? '')
				return entry ? [[ref, entry] as const] : []
			}),
		)
		if (copies.size < refs.length) {
			this.logger.warn(
				`Copy source missing user=${userId} message=${messageId} refs=${refs.length} found=${copies.size}`,
			)
			throw new TurnCopySourceMissingException()
		}
		return copies
	}

	/** Food is logged only in the window; the parser rejects other days, so a miss is a bug and stops the turn. */
	private assertLoggableDay({
		day,
		today,
		userId,
		messageId,
	}: {
		day: string
		today: string
		userId: string
		messageId: string
	}): void {
		const offset = getDayOffset(day, today)
		if (offset >= -ENTRY_BACKDATE_MAX_DAYS && offset <= ENTRY_AHEAD_MAX_DAYS) return
		this.logger.error(`Day out of range user=${userId} message=${messageId}`)
		throw new TurnDateOutOfRangeException()
	}

	/** Deletions first (the parser keeps them apart from new values), then the new values. */
	private async saveMeasurements(
		params: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'>,
		{
			measurements,
			measurementDeletions,
		}: {
			measurements: LogMeasurementInput[]
			measurementDeletions: DeleteMeasurementInput[]
		},
		tx: Prisma.TransactionClient,
	): Promise<string[]> {
		const deleted = await this.turnMeasurements.remove(
			{ ...params, deletions: measurementDeletions },
			tx,
		)
		const replaced = await this.turnMeasurements.record({ ...params, measurements }, tx)
		return [...deleted, ...replaced]
	}

	/**
	 * Each item goes to its own day (item, else the call, else today) and meal (item, else the call,
	 * else the clock of the turn — also for another day). Days outside the loggable window never get
	 * here: the parser rejects them, so a miss is a bug and stops the turn.
	 */
	private planEntries({
		params: { userId, timezone, message, now, localDate },
		log,
		memory,
		copies,
		isFromPhoto,
	}: {
		params: Pick<TurnParams, 'userId' | 'timezone' | 'message' | 'now' | 'localDate'>
		log: LogFoodInput
		memory: RelevantFoods
		copies: ReadonlyMap<string, EntryWithMealType>
		isFromPhoto: boolean
	}): { entries: MealEntryInput[]; getEatenAt: LogEntriesParams['getEatenAt'] } {
		const today = formatDbDate(localDate)
		const clockMealType = getMealTypeByHour(getLocalHour(now, timezone))
		const namedMeals = new Set<string>()
		const entries = log.items.map((item) => {
			const day = item.date ?? log.date ?? today
			this.assertLoggableDay({ day, today, userId, messageId: message.id })
			const namedType = item.mealType ?? log.mealType
			if (namedType) namedMeals.add(getMealKey(day, namedType))
			return {
				mealType: namedType ?? clockMealType,
				localDate: toDbDate(day),
				entry: this.toNewEntry(item, { memory, copies }, isFromPhoto),
			}
		})
		return {
			entries,
			getEatenAt: ({ type, localDate: mealDate }) =>
				getMealEatenAtForDay({
					mealType: type,
					isNamed: namedMeals.has(getMealKey(formatDbDate(mealDate), type)),
					localDate: mealDate,
					now,
					timezone,
				}),
		}
	}

	/**
	 * A memory item takes its numbers from the saved food, a copy item from the earlier entry, both
	 * scaled by the backend. A copyRef always has its entry here (loadCopySources throws otherwise).
	 */
	// mealType, date, memoryRef and copyRef aren't FoodEntry columns: left in the spread, Prisma would reject them
	private toNewEntry(
		{ memoryRef, copyRef, mealType: _mealType, date: _date, ...item }: AiFoodItem,
		{ memory, copies }: { memory: RelevantFoods; copies: ReadonlyMap<string, EntryWithMealType> },
		fromPhoto: boolean,
	): NewFoodEntry {
		const copied = copyRef === null ? undefined : copies.get(copyRef)
		if (copied) return { ...item, fromPhoto, ...copyEntryValues(copied, item.grams) }
		const food = memoryRef === null ? undefined : memory.byRef.get(memoryRef)
		if (!food) return { ...item, myFoodId: null, fromPhoto }
		return {
			...item,
			fromPhoto,
			...this.memoryService.getPortionValues(food, item.grams),
			source: 'MEMORY',
			myFoodId: food.id,
		}
	}
}
