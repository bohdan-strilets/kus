import { Injectable, Logger } from '@nestjs/common'
import {
	getNextTemplate,
	type LivePlanExercise,
	type NextTemplate,
	type ProgramDraft,
	type ProgramResponse,
	type ProgramView,
	type ProgramVersionListResponse,
	type SaveTemplateRequest,
	type UpdateProgramSettingsRequest,
} from '@kus/shared'

import { getLocalDateString } from '../../common/time'
import type { Prisma } from '../../generated/prisma/client'
import { UsersService } from '../users/users.service'
import { WorkoutsService } from '../workouts/workouts.service'
import {
	ProgramNotFoundException,
	ProgramTemplateNotFoundException,
	ProgramVersionConflictException,
} from './programs.exceptions'
import {
	type CreatedVersion,
	type CreateVersionInput,
	ProgramVersionsService,
} from './program-versions.service'
import {
	toLivePlanExercise,
	toProgramDraft,
	toProgramResponse,
	toVersionItem,
} from './programs.mapper'
import {
	hasActiveVersion,
	type ProgramWithVersion,
	ProgramsRepository,
} from './programs.repository'

/** The training program: versions are immutable, settings and weekdays change in place. */
@Injectable()
export class ProgramsService {
	private readonly logger = new Logger(ProgramsService.name)

	constructor(
		private readonly programsRepository: ProgramsRepository,
		private readonly workoutsService: WorkoutsService,
		private readonly usersService: UsersService,
		private readonly programVersions: ProgramVersionsService,
	) {}

	/** The active program with «next»; null when the user has none. */
	async getActive(userId: string): Promise<ProgramResponse | null> {
		const program = await this.programsRepository.findActive(userId)
		if (!hasActiveVersion(program)) return null
		return this.toResponse(userId, program)
	}

	/** The active version as a snapshot for the chat («покажи програму»); null without a program. */
	async getActiveView(userId: string): Promise<ProgramView | null> {
		const program = await this.programsRepository.findActive(userId)
		if (!hasActiveVersion(program)) return null
		const draft = toProgramDraft(program)
		if (!draft) return null
		const next = await this.getNext(userId, program)
		return {
			v: 1,
			versionId: program.activeVersion.id,
			versionCreatedAt: program.activeVersion.createdAt.toISOString(),
			program: draft,
			nextTemplateKey: next?.key ?? null,
		}
	}

	/** Whether the user has a live program (the training onboarding is offered only without one). */
	async hasActive(userId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
		return hasActiveVersion(await this.programsRepository.findActive(userId, tx))
	}

	/** Whether the template is one of the user's active program (a session is started only by such). */
	async hasActiveTemplate(userId: string, templateId: string): Promise<boolean> {
		const program = await this.programsRepository.findActive(userId)
		if (!hasActiveVersion(program)) return false
		return program.activeVersion.templates.some(({ id }) => id === templateId)
	}

	/**
	 * The plan of a live session: the template's exercises (of any version of the user's program)
	 * with the last time each was done and the progress hint. Null when it is not the user's.
	 */
	async getTemplatePlan(
		userId: string,
		templateId: string,
	): Promise<{ name: string; exercises: LivePlanExercise[] } | null> {
		const template = await this.programsRepository.findTemplate({ userId, id: templateId })
		if (!template) return null
		const exerciseIds = [
			...new Set(template.exercises.flatMap(({ exerciseId }) => exerciseId ?? [])),
		]
		// an open live session is never «the last time»: the repository leaves it out
		const lastSets = await this.workoutsService.getLastSets(userId, exerciseIds)
		return {
			name: template.name,
			exercises: template.exercises.map((exercise) => toLivePlanExercise(exercise, lastSets)),
		}
	}

	/** The ids of the template's exercises; empty when the template is not the user's. */
	async findTemplateExerciseIds(
		userId: string,
		templateId: string,
		tx?: Prisma.TransactionClient,
	): Promise<Set<string>> {
		const template = await this.programsRepository.findTemplate({ userId, id: templateId }, tx)
		return new Set(template?.exercises.map(({ id }) => id) ?? [])
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

	/** «Готово» of the template editor: the active version with this template's exercises (and name, when given) replaced. */
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
				template.key === edited.key
					? { ...template, exercises: request.exercises, name: request.name ?? template.name }
					: template,
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

	/** See ProgramVersionsService.createVersion. */
	createVersion(
		userId: string,
		input: CreateVersionInput,
		tx?: Prisma.TransactionClient,
	): Promise<CreatedVersion> {
		return this.programVersions.createVersion(userId, input, tx)
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
