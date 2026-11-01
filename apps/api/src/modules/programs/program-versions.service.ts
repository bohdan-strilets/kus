import { Injectable, Logger } from '@nestjs/common'
import { diffPrograms, type ProgramChanges, type ProgramDraft } from '@kus/shared'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { WorkoutsService } from '../workouts/workouts.service'
import {
	ProgramNotFoundException,
	ProgramProposalAlreadyAcceptedException,
	ProgramVersionConflictException,
} from './programs.exceptions'
import { normalizeDraft, toProgramDraft, toTemplateWrite } from './programs.mapper'
import { ProgramsRepository } from './programs.repository'

const UNIQUE_VIOLATION = 'P2002'

export const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

export interface CreateVersionInput {
	draft: ProgramDraft
	/** The version the draft was made against; null for the first version of a program. */
	baseVersionId: string | null
	/** The chat message this version accepts; null when it comes from the editor. */
	sourceMessageId: string | null
}

export interface CreatedVersion {
	programId: string
	versionId: string
	changes: ProgramChanges
}

/** New versions of the program: from the editor («Готово») or an accepted chat proposal. */
@Injectable()
export class ProgramVersionsService {
	private readonly logger = new Logger(ProgramVersionsService.name)

	constructor(
		private readonly programsRepository: ProgramsRepository,
		private readonly workoutsService: WorkoutsService,
		private readonly prisma: PrismaService,
	) {}

	/**
	 * One transaction: the version with its templates and exercises, then the compare-and-swap of the
	 * program onto it. A program that moved on meanwhile (or a second first-program) is a conflict and
	 * everything rolls back. Pass `tx` to join a bigger transaction (accepting a chat proposal).
	 */
	async createVersion(
		userId: string,
		input: CreateVersionInput,
		tx?: Prisma.TransactionClient,
	): Promise<CreatedVersion> {
		if (tx) return this.writeVersion(userId, input, tx)
		return this.prisma.$transaction((client) => this.writeVersion(userId, input, client))
	}

	private async writeVersion(
		userId: string,
		{ baseVersionId, sourceMessageId, ...input }: CreateVersionInput,
		tx: Prisma.TransactionClient,
	): Promise<CreatedVersion> {
		const draft = normalizeDraft(input.draft)
		await this.programsRepository.lockActive(userId, tx)
		const existing = await this.programsRepository.findActive(userId, tx)
		if (existing && existing.activeVersionId !== baseVersionId) {
			throw new ProgramVersionConflictException(existing.activeVersionId)
		}
		if (!existing && baseVersionId !== null) throw new ProgramNotFoundException()

		const programId = existing?.id ?? (await this.createProgram(userId, draft, tx))
		const changes = diffPrograms(existing ? toProgramDraft(existing) : null, draft)
		const version = await this.insertVersion({ userId, programId, sourceMessageId, changes }, tx)
		const keyToId = await this.writeTemplates(userId, version.id, draft, tx)

		const isActivated = await this.programsRepository.activateVersion(
			{
				userId,
				programId,
				baseVersionId,
				versionId: version.id,
				data: {
					title: draft.title,
					mode: draft.mode,
					perWeek: draft.perWeek,
					// the pin follows its key into the new version; gone with its template, it is none
					pinnedTemplateId: (draft.pinnedKey && keyToId.get(draft.pinnedKey)) || null,
				},
			},
			tx,
		)
		if (!isActivated) {
			const current = await this.programsRepository.findActive(userId, tx)
			throw new ProgramVersionConflictException(current?.activeVersionId ?? null)
		}
		this.logger.log(`Program version created user=${userId} version=${version.id}`)
		return { programId, versionId: version.id, changes }
	}

	/** The unique source message id turns a second accept of the same card into a 409. */
	private async insertVersion(
		data: {
			userId: string
			programId: string
			sourceMessageId: string | null
			changes: ProgramChanges
		},
		tx: Prisma.TransactionClient,
	): Promise<{ id: string }> {
		try {
			return await this.programsRepository.createVersion(data, tx)
		} catch (error) {
			if (data.sourceMessageId !== null && isUniqueViolation(error)) {
				throw new ProgramProposalAlreadyAcceptedException()
			}
			throw error
		}
	}

	private async createProgram(
		userId: string,
		draft: ProgramDraft,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		try {
			const { id } = await this.programsRepository.createProgram(
				{ userId, title: draft.title, mode: draft.mode, perWeek: draft.perWeek },
				tx,
			)
			return id
		} catch (error) {
			// two first programs at once: the partial unique let one in
			if (isUniqueViolation(error)) throw new ProgramVersionConflictException(null)
			throw error
		}
	}

	/** Templates and exercises of a version; template key → id of the new row. */
	private async writeTemplates(
		userId: string,
		versionId: string,
		draft: ProgramDraft,
		tx: Prisma.TransactionClient,
	): Promise<Map<string, string>> {
		const keyToId = new Map<string, string>()
		for (const [position, template] of draft.templates.entries()) {
			const rows = await this.workoutsService.findOrCreateExercises(userId, template.exercises, tx)
			const id = await this.programsRepository.createTemplate(
				{ userId, versionId, template: toTemplateWrite(template, position, rows) },
				tx,
			)
			keyToId.set(template.key, id)
		}
		return keyToId
	}
}
