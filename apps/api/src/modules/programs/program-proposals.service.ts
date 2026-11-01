import { Injectable, Logger } from '@nestjs/common'
import {
	type ProgramCard,
	type ProgramCardState,
	programCardSchema,
	type ProgramDraft,
	type ProposeProgramInput,
} from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import { WorkoutsService } from '../workouts/workouts.service'
import { deriveProgramCardState } from './program-card-state'
import { type ProgramChatContext, toProgramChatContext } from './program-chat-context'
import {
	type ProposalRefs,
	type RefRows,
	toProposalCard,
	toProposalDraft,
} from './program-proposal-card'
import { ProgramProposalsRepository } from './program-proposals.repository'
import { ProgramVersionsService } from './program-versions.service'
import { ProgramProposalAlreadyAcceptedException } from './programs.exceptions'
import { normalizeDraft, toProgramDraft } from './programs.mapper'
import { hasActiveVersion, ProgramsRepository } from './programs.repository'
import { ProgramsService } from './programs.service'

/**
 * propose_program, built: a card; nothing (the program already is that); nothing because the
 * program changed since the turn's context was built (the model saw another program); or nothing
 * because the built card is not a valid card (the reply keeps the model's text).
 */
export type ProposalCardResult =
	| { status: 'CARD'; card: ProgramCard }
	| { status: 'UNCHANGED' }
	| { status: 'BASE_CHANGED' }
	| { status: 'INVALID' }

/** A card of the chat feed whose state is asked for. */
export interface StoredCardRef {
	messageId: string
	baseVersionId: string | null
}

/** The program in the chat: the model's context, its proposals as cards, accepting one. */
@Injectable()
export class ProgramProposalsService {
	private readonly logger = new Logger(ProgramProposalsService.name)

	constructor(
		private readonly programsService: ProgramsService,
		private readonly programsRepository: ProgramsRepository,
		private readonly proposalsRepository: ProgramProposalsRepository,
		private readonly programVersions: ProgramVersionsService,
		private readonly workoutsService: WorkoutsService,
	) {}

	/**
	 * The «Program» section, its t-refs and the version it shows; `exerciseRefs` maps dictionary id →
	 * x-ref of «Exercises», `pending` is the open card's proposal.
	 */
	async getContext(
		userId: string,
		{
			exerciseRefs,
			pending,
		}: { exerciseRefs: ReadonlyMap<string, string>; pending: ProgramDraft | null },
	): Promise<ProgramChatContext> {
		return toProgramChatContext(await this.programsService.getActive(userId), exerciseRefs, pending)
	}

	/**
	 * propose_program → the card against the active program, only while it is the version the
	 * turn's context showed (`contextVersionId`). Reads only: names are looked up in the dictionary,
	 * never created (accepting creates them).
	 */
	async buildProposalCard(
		userId: string,
		input: ProposeProgramInput,
		{ refs, contextVersionId }: { refs: ProposalRefs; contextVersionId: string | null },
	): Promise<ProposalCardResult> {
		const { base, baseVersionId } = await this.getBase(userId)
		if (baseVersionId !== contextVersionId) {
			this.logger.log(
				`Program changed since the context user=${userId} context=${contextVersionId ?? 'none'} active=${baseVersionId ?? 'none'}`,
			)
			return { status: 'BASE_CHANGED' }
		}
		const rows = await Promise.all(
			input.templates.map((template) =>
				this.workoutsService.findExercisesByNames(
					userId,
					template.exercises.map(({ name }) => name),
				),
			),
		)
		const refRows = await this.findRefRows(userId, input, refs)
		const draft = toProposalDraft(input, { base, baseVersionId, refs, rows, refRows })
		const card = toProposalCard(draft, { base, baseVersionId })
		if (card === null) return { status: 'UNCHANGED' }
		// a card is stored as is and read back with this schema: one that would not parse is no card
		if (!programCardSchema.safeParse(card).success) {
			this.logger.warn(
				`Program card does not parse user=${userId} templates=${card.program.templates.length}`,
			)
			return { status: 'INVALID' }
		}
		return { status: 'CARD', card }
	}

	private async findRefRows(
		userId: string,
		input: ProposeProgramInput,
		refs: ProposalRefs,
	): Promise<RefRows> {
		const ids = new Set(
			input.templates.flatMap(({ exercises }) =>
				exercises.flatMap(({ exerciseRef }) => {
					const id = exerciseRef === null ? undefined : refs.exerciseIds.get(exerciseRef)
					return id === undefined ? [] : [id]
				}),
			),
		)
		if (ids.size === 0) return new Map()
		const rows = await this.workoutsService.findExercisesByIds(userId, [...ids])
		return new Map(rows.map((row) => [row.id, row]))
	}

	/** «Перерахувати»: the same draft against the program as it is now, without the model. */
	async rebuildCard(
		userId: string,
		draft: ProgramDraft,
		tx?: Prisma.TransactionClient,
	): Promise<ProgramCard | null> {
		const { base, baseVersionId } = await this.getBase(userId, tx)
		return toProposalCard(normalizeDraft(draft), { base, baseVersionId })
	}

	/**
	 * The card becomes a version, in the caller's transaction, after assertNotAccepted; a parallel
	 * second accept still ends as a 409 (the unique source message id).
	 */
	async accept(
		userId: string,
		{ messageId, card }: { messageId: string; card: ProgramCard },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await this.programVersions.createVersion(
			userId,
			{ draft: card.program, baseVersionId: card.baseVersionId, sourceMessageId: messageId },
			tx,
		)
	}

	async assertNotAccepted(
		userId: string,
		messageId: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const accepted = await this.proposalsRepository.findVersionBySourceMessage(
			{ userId, messageId },
			tx,
		)
		if (accepted) throw new ProgramProposalAlreadyAcceptedException()
	}

	/**
	 * The template a log_workout binds to: the id behind the turn's t-ref, only while it is still in
	 * the active version. A miss is null (the workout stays unbound).
	 */
	async resolveTemplateIds(
		userId: string,
		templateIds: readonly string[],
	): Promise<ReadonlySet<string>> {
		if (templateIds.length === 0) return new Set()
		const program = await this.programsRepository.findActive(userId)
		const live = new Set(program?.activeVersion?.templates.map(({ id }) => id) ?? [])
		const missing = templateIds.filter((id) => !live.has(id))
		if (missing.length > 0) {
			this.logger.warn(`Template ref out of date user=${userId} templates=${missing.join(',')}`)
		}
		return new Set(templateIds.filter((id) => live.has(id)))
	}

	/** The states of the feed's cards: one query for the accepted ones, one for the program. */
	async getCardStates(
		userId: string,
		cards: readonly StoredCardRef[],
		newestCardMessageId: string | null,
	): Promise<Map<string, ProgramCardState>> {
		const states = new Map<string, ProgramCardState>()
		if (cards.length === 0) return states
		const [versions, program] = await Promise.all([
			this.proposalsRepository.findVersionsBySourceMessages({
				userId,
				messageIds: cards.map(({ messageId }) => messageId),
			}),
			this.programsRepository.findActive(userId),
		])
		const acceptedAt = new Map(
			versions.flatMap(({ sourceMessageId, createdAt }) =>
				sourceMessageId === null ? [] : [[sourceMessageId, createdAt] as const],
			),
		)
		for (const { messageId, baseVersionId } of cards) {
			states.set(
				messageId,
				deriveProgramCardState({
					messageId,
					baseVersionId,
					acceptedAt: acceptedAt.get(messageId) ?? null,
					newestCardMessageId,
					activeVersionId: program?.activeVersionId ?? null,
				}),
			)
		}
		return states
	}

	private async getBase(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<{ base: ProgramDraft | null; baseVersionId: string | null }> {
		const program = await this.programsRepository.findActive(userId, tx)
		if (!hasActiveVersion(program)) return { base: null, baseVersionId: null }
		return { base: toProgramDraft(program), baseVersionId: program.activeVersionId }
	}
}
