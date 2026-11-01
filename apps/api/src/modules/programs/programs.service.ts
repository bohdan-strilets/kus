import { Injectable, Logger } from '@nestjs/common'
import {
	diffPrograms,
	getNextTemplate,
	type NextTemplate,
	type ProgramChanges,
	type ProgramDraft,
	type ProgramResponse,
	type ProgramVersionListResponse,
	type SaveTemplateRequest,
	type UpdateProgramSettingsRequest,
} from '@kus/shared'

import { getLocalDateString } from '../../common/time'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { UsersService } from '../users/users.service'
import { WorkoutsService } from '../workouts/workouts.service'
import {
	ProgramNotFoundException,
	ProgramTemplateNotFoundException,
	ProgramVersionConflictException,
} from './programs.exceptions'
import {
	normalizeDraft,
	toProgramDraft,
	toProgramResponse,
	toTemplateWrite,
	toVersionItem,
} from './programs.mapper'
import { type ActiveProgram, ProgramsRepository } from './programs.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
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

type ProgramWithVersion = ActiveProgram & {
	activeVersion: NonNullable<ActiveProgram['activeVersion']>
}

const hasActiveVersion = (program: ActiveProgram | null): program is ProgramWithVersion =>
	program?.activeVersion != null

/** The training program: versions are immutable, settings and weekdays change in place. */
@Injectable()
export class ProgramsService {
	private readonly logger = new Logger(ProgramsService.name)

	constructor(
		private readonly programsRepository: ProgramsRepository,
		private readonly workoutsService: WorkoutsService,
		private readonly usersService: UsersService,
		private readonly prisma: PrismaService,
	) {}

	/** The active program with «next»; null when the user has none. */
	async getActive(userId: string): Promise<ProgramResponse | null> {
		const program = await this.programsRepository.findActive(userId)
		if (!hasActiveVersion(program)) return null
		return this.toResponse(userId, program)
	}

	async listVersions(userId: string): Promise<ProgramVersionListResponse> {
		const program = await this.programsRepository.findActive(userId)
		if (!program) throw new ProgramNotFoundException()
		const versions = await this.programsRepository.findVersions({ userId, programId: program.id })
		return versions.map((version) => toVersionItem(version, program.activeVersionId))
	}

	/** Mode, pin and times a week change in place, without a new version. */
	async updateSettings(
		userId: string,
		body: UpdateProgramSettingsRequest,
	): Promise<ProgramResponse> {
		const program = await this.requireActive(userId)
		const templates = program.activeVersion.templates
		if (body.pinnedTemplateId && !templates.some(({ id }) => id === body.pinnedTemplateId)) {
			throw new ProgramTemplateNotFoundException()
		}
		const mode = body.mode ?? program.mode
		const pinnedTemplateId =
			body.pinnedTemplateId === undefined ? program.pinnedTemplateId : body.pinnedTemplateId
		const data = {
			...(body.mode === undefined ? {} : { mode: body.mode }),
			...(body.perWeek === undefined ? {} : { perWeek: body.perWeek }),
			...(mode === 'SINGLE' && pinnedTemplateId === null
				? { pinnedTemplateId: await this.getCurrentNextId(userId, program) }
				: body.pinnedTemplateId === undefined
					? {}
					: { pinnedTemplateId: body.pinnedTemplateId }),
		}
		if (!(await this.programsRepository.updateSettings({ userId, id: program.id, data }))) {
			throw new ProgramNotFoundException()
		}
		return this.getActiveOrThrow(userId)
	}

	async updateTemplateWeekdays(
		userId: string,
		templateId: string,
		weekdays: number[],
	): Promise<ProgramResponse> {
		const program = await this.requireActive(userId)
		const isUpdated = await this.programsRepository.updateTemplateWeekdays({
			userId,
			templateId,
			versionId: program.activeVersion.id,
			weekdays: [...weekdays].sort((a, b) => a - b),
		})
		if (!isUpdated) throw new ProgramTemplateNotFoundException()
		return this.getActiveOrThrow(userId)
	}

	/** «Готово» of the template editor: the active version with this template's exercises replaced. */
	async saveTemplate(userId: string, request: SaveTemplateRequest): Promise<ProgramResponse> {
		const program = await this.requireActive(userId)
		// a stale editor is a conflict before anything else: its template id may be gone from the new version
		if (program.activeVersionId !== request.baseVersionId) {
			throw new ProgramVersionConflictException(program.activeVersionId)
		}
		const base = toProgramDraft(program)
		const edited = program.activeVersion.templates.find(({ id }) => id === request.templateId)
		if (!base || !edited) throw new ProgramTemplateNotFoundException()
		const draft: ProgramDraft = {
			...base,
			templates: base.templates.map((template) =>
				template.key === edited.key ? { ...template, exercises: request.exercises } : template,
			),
		}
		await this.createVersion(userId, {
			draft,
			baseVersionId: request.baseVersionId,
			sourceMessageId: null,
		})
		return this.getActiveOrThrow(userId)
	}

	async remove(userId: string): Promise<void> {
		if (!(await this.programsRepository.softDelete(userId))) throw new ProgramNotFoundException()
		this.logger.log(`Program removed user=${userId}`)
	}

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
		const version = await this.programsRepository.createVersion(
			{ userId, programId, sourceMessageId, changes },
			tx,
		)
		const keyToId = await this.writeTemplates(userId, version.id, draft, tx)
		const pinnedKey = existing?.activeVersion?.templates.find(
			({ id }) => id === existing.pinnedTemplateId,
		)?.key

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
					pinnedTemplateId: (pinnedKey && keyToId.get(pinnedKey)) || null,
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

	private async requireActive(userId: string): Promise<ProgramWithVersion> {
		const program = await this.programsRepository.findActive(userId)
		if (!hasActiveVersion(program)) throw new ProgramNotFoundException()
		return program
	}

	private async getActiveOrThrow(userId: string): Promise<ProgramResponse> {
		const response = await this.getActive(userId)
		if (!response) throw new ProgramNotFoundException()
		return response
	}

	private async getCurrentNextId(userId: string, program: ProgramWithVersion): Promise<string> {
		const next = await this.getNext(userId, program)
		const { templates } = program.activeVersion
		const template = templates.find(({ key }) => key === next?.key) ?? templates[0]
		if (!template) throw new ProgramNotFoundException()
		return template.id
	}

	/** «Next» by the program's mode, the last templated workout and the user's local today. */
	private async getNext(userId: string, program: ProgramWithVersion): Promise<NextTemplate | null> {
		const [last, user] = await Promise.all([
			this.workoutsService.findLastTemplatedWorkout(userId),
			this.usersService.getMe(userId),
		])
		const { templates } = program.activeVersion
		return getNextTemplate({
			mode: program.mode,
			templates,
			pinnedTemplateKey: templates.find(({ id }) => id === program.pinnedTemplateId)?.key ?? null,
			lastTemplatedWorkout: last,
			today: getLocalDateString(new Date(), user.timezone),
		})
	}

	private async toResponse(userId: string, program: ProgramWithVersion): Promise<ProgramResponse> {
		const exerciseIds = [
			...new Set(
				program.activeVersion.templates.flatMap(({ exercises }) =>
					exercises.flatMap(({ exerciseId }) => exerciseId ?? []),
				),
			),
		]
		const [lastSets, next] = await Promise.all([
			this.workoutsService.getLastSets(userId, exerciseIds),
			this.getNext(userId, program),
		])
		return toProgramResponse({ program, lastSets, next })
	}
}
