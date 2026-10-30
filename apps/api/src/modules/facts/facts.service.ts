import { Injectable, Logger } from '@nestjs/common'
import {
	FACT_TEXT_MAX_LENGTH,
	FACTS_MAX,
	getFactTextIssue,
	normalizeFactText,
	type AnswerFactRequest,
	type FactCategory,
	type FactResponse,
	type FactTextIssue,
} from '@kus/shared'

import { Prisma, type UserFact } from '../../generated/prisma/client'
import {
	FactExistsException,
	FactNotFoundException,
	FactNotProposedException,
	FactsLimitReachedException,
} from './facts.exceptions'
import { toFactResponse } from './facts.mapper'
import { FactsRepository } from './facts.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** Same transform as `factTextSchema`: one line, single spaces. */
const toOneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

export type SaveFactIssue = FactTextIssue | 'EMPTY' | 'TOO_LONG'

export interface SaveFactFromChatInput {
	text: string
	category: FactCategory
	/** «Запам'ятай, що…» — saved at once; otherwise it's a proposal waiting for «Так / Ні». */
	explicit: boolean
	sourceMessageId: string | null
}

export type SaveFactFromChatResult =
	| { kind: 'saved'; fact: UserFact }
	| { kind: 'proposed'; fact: UserFact }
	/** The same text is already confirmed (or already proposed): nothing written. */
	| { kind: 'exists'; fact: UserFact }
	| { kind: 'limit' }
	| { kind: 'rejected'; issue: SaveFactIssue }

export interface ContextFacts {
	confirmed: UserFact[]
	proposal: UserFact | null
}

/**
 * «Пам'ять · Про тебе»: short facts about the user's habits. Texts never reach the logs (ids and
 * counts only) and never contain health data, body numbers or instructions (the fact guard).
 */
@Injectable()
export class FactsService {
	private readonly logger = new Logger(FactsService.name)

	constructor(private readonly factsRepository: FactsRepository) {}

	async list(userId: string): Promise<FactResponse[]> {
		const facts = await this.factsRepository.findConfirmedByCategory(userId)
		return facts.map(toFactResponse)
	}

	async update(userId: string, id: string, text: string): Promise<FactResponse> {
		const fact = await this.getActiveConfirmed(userId, id)
		const textNormalized = normalizeFactText(text)
		if (textNormalized !== fact.textNormalized) {
			await this.assertTextFree({ userId, textNormalized, exceptId: id })
		}
		try {
			const isUpdated = await this.factsRepository.updateText({ userId, id, text, textNormalized })
			if (!isUpdated) throw new FactNotFoundException()
		} catch (error) {
			// the pre-check lost a race with a parallel save of the same text
			if (isUniqueViolation(error)) return this.throwExists(userId, textNormalized)
			throw error
		}
		return toFactResponse(await this.getActiveConfirmed(userId, id))
	}

	async remove(userId: string, id: string): Promise<void> {
		const isDeleted = await this.factsRepository.setDeletedAt({
			userId,
			id,
			deletedAt: new Date(),
		})
		if (!isDeleted) throw new FactNotFoundException()
	}

	async restore(userId: string, id: string): Promise<FactResponse> {
		const fact = await this.factsRepository.findById({ userId, id })
		if (!fact || fact.status !== 'CONFIRMED') throw new FactNotFoundException()
		if (fact.deletedAt === null) return toFactResponse(fact)
		await this.assertConfirmedBelowLimit(userId)
		await this.assertTextFree({ userId, textNormalized: fact.textNormalized, exceptId: id })
		try {
			await this.factsRepository.setDeletedAt({ userId, id, deletedAt: null })
		} catch (error) {
			if (isUniqueViolation(error)) return this.throwExists(userId, fact.textNormalized)
			throw error
		}
		return toFactResponse(await this.getActiveConfirmed(userId, id))
	}

	/**
	 * «Так / Ні» under a proposal. The same answer again returns the current fact; the opposite one
	 * after a decision is 409. Accepting never meets a duplicate text: the partial unique index
	 * already counts a proposal, so a confirmed twin can't exist next to it.
	 */
	async answer(userId: string, id: string, { accept }: AnswerFactRequest): Promise<FactResponse> {
		const fact = await this.factsRepository.findById({ userId, id })
		if (!fact || fact.deletedAt !== null) throw new FactNotFoundException()

		const target = accept ? 'CONFIRMED' : 'REJECTED'
		if (fact.status === target) return toFactResponse(fact)
		if (fact.status !== 'PROPOSED') throw new FactNotProposedException()

		if (accept) await this.assertConfirmedBelowLimit(userId)
		const isChanged = await this.factsRepository.changeStatus({
			userId,
			id,
			from: 'PROPOSED',
			to: target,
		})
		const current = await this.factsRepository.findById({ userId, id })
		if (!current || current.deletedAt !== null) throw new FactNotFoundException()
		// a parallel tap answered first: same answer is fine, the opposite is the 409 above
		if (!isChanged && current.status !== target) throw new FactNotProposedException()
		return toFactResponse(current)
	}

	/**
	 * The chat turn's `save_fact` (inside its transaction). The text is checked here too, because
	 * this path doesn't go through the DTO.
	 */
	async saveFromChat(
		userId: string,
		input: SaveFactFromChatInput,
		tx: Prisma.TransactionClient,
	): Promise<SaveFactFromChatResult> {
		const text = toOneLine(input.text)
		if (text.length === 0) return { kind: 'rejected', issue: 'EMPTY' }
		if (text.length > FACT_TEXT_MAX_LENGTH) return { kind: 'rejected', issue: 'TOO_LONG' }
		const issue = getFactTextIssue(text)
		if (issue !== null) return { kind: 'rejected', issue }

		const textNormalized = normalizeFactText(text)
		const existing = await this.factsRepository.findLiveByText({ userId, textNormalized }, tx)
		if (existing?.status === 'CONFIRMED') return { kind: 'exists', fact: existing }
		if (existing && !input.explicit) return { kind: 'exists', fact: existing }

		if (input.explicit && (await this.factsRepository.countConfirmed(userId, tx)) >= FACTS_MAX) {
			return { kind: 'limit' }
		}

		if (existing) {
			// «Запам'ятай» for what is waiting as a proposal confirms that proposal
			await this.factsRepository.changeStatus(
				{ userId, id: existing.id, from: 'PROPOSED', to: 'CONFIRMED' },
				tx,
			)
			const confirmed = await this.factsRepository.findById({ userId, id: existing.id }, tx)
			if (!confirmed) throw new FactNotFoundException()
			return { kind: 'saved', fact: confirmed }
		}

		const base = {
			userId,
			text,
			textNormalized,
			category: input.category,
			sourceMessageId: input.sourceMessageId,
		}
		if (input.explicit) {
			const fact = await this.factsRepository.create({ ...base, status: 'CONFIRMED' }, tx)
			return { kind: 'saved', fact }
		}
		const replaced = await this.factsRepository.rejectOpenProposals(userId, tx)
		const fact = await this.factsRepository.create({ ...base, status: 'PROPOSED' }, tx)
		if (replaced > 0) this.logger.log(`Proposal ${fact.id} replaced ${replaced} open one(s)`)
		return { kind: 'proposed', fact }
	}

	/** «Забудь це»: soft delete of an active confirmed fact; false = no such fact. */
	forgetFromChat(userId: string, factId: string, tx: Prisma.TransactionClient): Promise<boolean> {
		return this.factsRepository.setDeletedAt({ userId, id: factId, deletedAt: new Date() }, tx)
	}

	/** What the model sees: confirmed facts (oldest first) and the proposal waiting for an answer. */
	async findContextFacts(userId: string): Promise<ContextFacts> {
		const [confirmed, proposal] = await Promise.all([
			this.factsRepository.findConfirmedOldestFirst({ userId, limit: FACTS_MAX }),
			this.factsRepository.findOpenProposal(userId),
		])
		return { confirmed, proposal }
	}

	/** Facts the given messages proposed or saved, any status: the chat feed's plaques. */
	findProposalsByMessages(userId: string, messageIds: string[]): Promise<UserFact[]> {
		if (messageIds.length === 0) return Promise.resolve([])
		return this.factsRepository.findByMessages({ userId, messageIds })
	}

	private async getActiveConfirmed(userId: string, id: string): Promise<UserFact> {
		const fact = await this.factsRepository.findById({ userId, id })
		if (!fact || fact.deletedAt !== null || fact.status !== 'CONFIRMED') {
			throw new FactNotFoundException()
		}
		return fact
	}

	private async assertConfirmedBelowLimit(userId: string): Promise<void> {
		if ((await this.factsRepository.countConfirmed(userId)) >= FACTS_MAX) {
			throw new FactsLimitReachedException()
		}
	}

	private async assertTextFree({
		userId,
		textNormalized,
		exceptId,
	}: {
		userId: string
		textNormalized: string
		exceptId: string
	}): Promise<void> {
		const existing = await this.factsRepository.findLiveByText({ userId, textNormalized })
		if (existing && existing.id !== exceptId) throw new FactExistsException(existing.id)
	}

	private async throwExists(userId: string, textNormalized: string): Promise<never> {
		const existing = await this.factsRepository.findLiveByText({ userId, textNormalized })
		if (!existing) throw new FactNotFoundException()
		throw new FactExistsException(existing.id)
	}
}
