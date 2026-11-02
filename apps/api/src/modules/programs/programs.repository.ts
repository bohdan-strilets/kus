import { Injectable } from '@nestjs/common'
import type { ProgramMode } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import type { ExerciseKind, MuscleGroup } from '../../generated/prisma/enums'
import { PrismaService } from '../../prisma'

/** The active version with its templates and exercises, in order; the dictionary's group wins over the snapshot. */
const WITH_ACTIVE_VERSION = {
	activeVersion: {
		include: {
			templates: {
				orderBy: { position: 'asc' },
				include: {
					exercises: {
						orderBy: { position: 'asc' },
						include: { exercise: { select: { muscleGroup: true, isBodyweight: true } } },
					},
				},
			},
		},
	},
} satisfies Prisma.WorkoutProgramInclude

export type ActiveProgram = Prisma.WorkoutProgramGetPayload<{ include: typeof WITH_ACTIVE_VERSION }>

export type ProgramWithVersion = ActiveProgram & {
	activeVersion: NonNullable<ActiveProgram['activeVersion']>
}

export const hasActiveVersion = (program: ActiveProgram | null): program is ProgramWithVersion =>
	program?.activeVersion != null

export interface ProgramSettingsWrite {
	mode?: ProgramMode
	perWeek?: number | null
	pinnedTemplateId?: string | null
}

export interface TemplateExerciseWrite {
	exerciseId: string | null
	name: string
	kind: ExerciseKind
	muscleGroup: MuscleGroup | null
	position: number
	sets: number | null
	repsMin: number | null
	repsMax: number | null
	weightKg: number | null
	progressStepKg: number | null
	restSec: number | null
	durationMin: number | null
	distanceM: number | null
}

export interface TemplateWrite {
	key: string
	name: string
	position: number
	weekdays: number[]
	exercises: TemplateExerciseWrite[]
}

/** Only Prisma; every read and write carries the owner's `userId`. */
@Injectable()
export class ProgramsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The owner's live program with its active version; null when there is none. */
	findActive(userId: string, tx?: Prisma.TransactionClient): Promise<ActiveProgram | null> {
		return (tx ?? this.prisma).workoutProgram.findFirst({
			where: { userId, deletedAt: null },
			include: WITH_ACTIVE_VERSION,
		})
	}

	/**
	 * Locks the owner's live program row until the transaction ends. Without it two saves both take a
	 * share lock through their version's foreign key and deadlock on the swap; with it the second one
	 * waits, then sees the new active version and ends as a plain conflict.
	 */
	async lockActive(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		await tx.$queryRaw`SELECT id FROM workout_programs WHERE user_id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`
	}

	/** Versions of the program, newest first. */
	findVersions({ userId, programId }: { userId: string; programId: string }) {
		return this.prisma.programVersion.findMany({
			where: { userId, programId },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { id: true, createdAt: true, changes: true },
		})
	}

	createProgram(
		data: { userId: string; title: string | null; mode: ProgramMode; perWeek: number | null },
		tx: Prisma.TransactionClient,
	) {
		return tx.workoutProgram.create({ data, select: { id: true } })
	}

	createVersion(
		data: {
			userId: string
			programId: string
			sourceMessageId: string | null
			changes: Prisma.InputJsonValue
		},
		tx: Prisma.TransactionClient,
	) {
		return tx.programVersion.create({ data, select: { id: true } })
	}

	/** Creates one template with its exercises; returns the template's id. */
	async createTemplate(
		{ userId, versionId, template }: { userId: string; versionId: string; template: TemplateWrite },
		tx: Prisma.TransactionClient,
	): Promise<string> {
		const { id } = await tx.workoutTemplate.create({
			data: {
				userId,
				versionId,
				key: template.key,
				name: template.name,
				position: template.position,
				weekdays: template.weekdays,
				exercises: { create: template.exercises },
			},
			select: { id: true },
		})
		return id
	}

	/**
	 * Compare-and-swap of the active version: moves the program to `versionId` only while it still
	 * points at `baseVersionId` (null for a program being created). False when someone got there first.
	 */
	async activateVersion(
		{
			userId,
			programId,
			baseVersionId,
			versionId,
			data,
		}: {
			userId: string
			programId: string
			baseVersionId: string | null
			versionId: string
			data: {
				title: string | null
				mode: ProgramMode
				perWeek: number | null
				pinnedTemplateId: string | null
			}
		},
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await tx.workoutProgram.updateMany({
			where: { id: programId, userId, deletedAt: null, activeVersionId: baseVersionId },
			data: { ...data, activeVersionId: versionId },
		})
		return count > 0
	}

	async updateSettings({
		userId,
		id,
		data,
	}: {
		userId: string
		id: string
		data: ProgramSettingsWrite
	}): Promise<boolean> {
		const { count } = await this.prisma.workoutProgram.updateMany({
			where: { id, userId, deletedAt: null },
			data,
		})
		return count > 0
	}

	/** Weekdays are the one thing of a template edited in place; false when it is not in this version. */
	async updateTemplateWeekdays({
		userId,
		templateId,
		versionId,
		weekdays,
	}: {
		userId: string
		templateId: string
		versionId: string
		weekdays: number[]
	}): Promise<boolean> {
		const { count } = await this.prisma.workoutTemplate.updateMany({
			where: { id: templateId, userId, versionId },
			data: { weekdays },
		})
		return count > 0
	}

	async softDelete(userId: string): Promise<boolean> {
		const { count } = await this.prisma.workoutProgram.updateMany({
			where: { userId, deletedAt: null },
			data: { deletedAt: new Date() },
		})
		return count > 0
	}
}
