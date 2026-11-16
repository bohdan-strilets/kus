import { Injectable } from '@nestjs/common'
import {
	type HistoryAppChange,
	type HistoryMarkerFields,
	type HistoryTurn,
	PREVIOUS_DAY_TAIL_MAX_MESSAGES,
} from '@kus/shared'

import { MessageRole } from '../../generated/prisma/client'
import { EntriesService } from '../entries/entries.service'
import type { WorkoutRefIds } from '../workouts/workout-refs'
import {
	ChatRepository,
	DAY_HISTORY_QUERY_CAP,
	type MessageWithAttachments,
} from './chat.repository'
import { ChatHistoryMarkersService } from './chat-history-markers.service'
import {
	getDeletedEntryIds,
	groupEntryIdsBySourceMessage,
	mergeSourceEntries,
} from './history-entries'
import { buildCorrectionContext, type HistoryCorrectionContext } from './history-corrections'
import { toHistoryTurns } from './history-turns'

export interface HistoryRows {
	/** The day, oldest first. */
	dayRows: MessageWithAttachments[]
	/** The end of the day before, oldest first; empty when the day hit the query cap. */
	tail: MessageWithAttachments[]
	/** The tail, then the day. */
	history: MessageWithAttachments[]
	userMessages: MessageWithAttachments[]
}

export interface HistoryMarkersData {
	markers: ReadonlyMap<string, HistoryMarkerFields>
	readDigests: ReadonlyMap<string, string[]>
}

interface SourceEntry {
	id: string
	sourceMessageId: string | null
	isDeleted: boolean
}

/** The chat history of a turn: the day and the end of the day before, as the turns the model reads. */
@Injectable()
export class ChatHistoryContextService {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly historyMarkers: ChatHistoryMarkersService,
		private readonly entriesService: EntriesService,
	) {}

	async loadRows({
		userId,
		message,
		historySince,
	}: {
		userId: string
		message: MessageWithAttachments
		historySince: Date
	}): Promise<HistoryRows> {
		const [dayRows, tailRows] = await Promise.all([
			this.chatRepository.findDayHistory({ userId, beforeId: message.id, since: historySince }),
			// the end of the day before; the selection trims it to its budget
			this.chatRepository.findHistory({
				userId,
				beforeId: message.id,
				before: historySince,
				limit: PREVIOUS_DAY_TAIL_MAX_MESSAGES,
			}),
		])
		// both lists are oldest first: the day before, then the day
		// a day that hit the query cap lost its oldest messages: the day before would sit next to a gap
		const tail = dayRows.length >= DAY_HISTORY_QUERY_CAP ? [] : tailRows
		const history = [...tail, ...dayRows]
		return {
			dayRows,
			tail,
			history,
			userMessages: history.filter(({ role }) => role === MessageRole.USER),
		}
	}

	/** What the turns did besides logging food, and what Kusik read in each of them. */
	async loadMarkers({
		userId,
		userMessageIds,
		workoutRefIds,
		factRefById,
		foodRefById,
	}: {
		userId: string
		userMessageIds: string[]
		workoutRefIds: WorkoutRefIds
		factRefById: ReadonlyMap<string, string>
		foodRefById: ReadonlyMap<string, string>
	}): Promise<HistoryMarkersData> {
		const [markers, readDigests] = await Promise.all([
			// after the workouts and facts: the refs they got in this request are what the markers show
			this.historyMarkers.getMarkers({
				userId,
				messageIds: userMessageIds,
				workoutRefIds,
				factRefById,
				foodRefById,
			}),
			// what Kusik read in each turn: the numbers of its replies come from there
			this.historyMarkers.getReadDigests(userId, userMessageIds),
		])
		return { markers, readDigests }
	}

	async buildTurns({
		userId,
		message,
		rows,
		dayStart,
		refByEntryId,
		editableSourceEntries,
		markersData,
		forgottenRefById,
	}: {
		userId: string
		message: MessageWithAttachments
		rows: HistoryRows
		dayStart: Date
		refByEntryId: ReadonlyMap<string, string>
		/** The entries of the day's window with the message that logged them. */
		editableSourceEntries: SourceEntry[]
		markersData: HistoryMarkersData
		/** Food id → `g1…` of «Foods forgotten today». */
		forgottenRefById: ReadonlyMap<string, string>
	}): Promise<{
		historyTurns: HistoryTurn[]
		previousDayTurns: HistoryTurn[]
		appChanges: HistoryAppChange[] | undefined
	}> {
		const { dayRows, tail, history, userMessages } = rows
		// the messages from before midnight (the evening before, the end of the day before) logged
		// entries that the window does not hold
		const earlierSourceEntries = await this.entriesService.findSourceEntries(
			userId,
			userMessages.filter(({ createdAt }) => createdAt < dayStart).map(({ id }) => id),
		)
		// all the entries, not only the windowed ones: a turn whose entries lost their refs must
		// still read as logged
		const sourceMessages = mergeSourceEntries(editableSourceEntries, earlierSourceEntries)
		const entryIdsBySourceMessageId = groupEntryIdsBySourceMessage(sourceMessages)
		const deletedEntryIds = getDeletedEntryIds(sourceMessages)
		const corrections = await this.getCorrectionContext({
			userId,
			history,
			message,
			deletedEntryIds,
			refByEntryId,
			forgottenRefById,
		})
		const toTurns = (turnRows: MessageWithAttachments[]): HistoryTurn[] =>
			turnRows.flatMap((turn) =>
				toHistoryTurns(turn, refByEntryId, entryIdsBySourceMessageId, {
					deletedEntryIds,
					markers: markersData.markers.get(turn.id),
					corrections,
					readDigests: markersData.readDigests,
				}),
			)
		return {
			historyTurns: toTurns(dayRows),
			previousDayTurns: toTurns(tail),
			appChanges: corrections.appChangesByMessageId.get(message.id),
		}
	}

	/** Who deleted the entries, what Kusik did in each turn and what the user changed in the app. */
	private async getCorrectionContext({
		userId,
		history,
		message,
		deletedEntryIds,
		refByEntryId,
		forgottenRefById,
	}: {
		userId: string
		/** Oldest first. */
		history: MessageWithAttachments[]
		message: MessageWithAttachments
		deletedEntryIds: ReadonlySet<string>
		refByEntryId: ReadonlyMap<string, string>
		forgottenRefById: ReadonlyMap<string, string>
	}): Promise<HistoryCorrectionContext> {
		const [oldest] = history
		const messageIds = history.filter(({ role }) => role === MessageRole.USER).map(({ id }) => id)
		const [corrections, foodActionsByMessageId] = await Promise.all([
			oldest
				? this.entriesService.findHistoryCorrections({
						userId,
						entryIds: [...deletedEntryIds],
						messageIds,
						since: oldest.createdAt,
					})
				: [],
			this.historyMarkers.getFoodActions({ userId, messageIds, forgottenRefById }),
		])
		return buildCorrectionContext({
			corrections,
			history,
			current: message,
			refByEntryId,
			foodActionsByMessageId,
		})
	}
}
