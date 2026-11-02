import { Injectable } from '@nestjs/common'
import { type FormExerciseInput, type LiveExerciseInput, matchMuscleGroup } from '@kus/shared'

import type { Prisma } from '../../generated/prisma/client'
import type { MuscleGroup } from '../../generated/prisma/enums'
import { ProgramTemplateNotFoundException } from '../programs/programs.exceptions'
import { ProgramsService } from '../programs/programs.service'
import { WorkoutsService } from '../workouts/workouts.service'

type ExerciseInput = LiveExerciseInput | FormExerciseInput

/** The dictionary row an exercise of the live mode or the form is written with, and its group. */
export interface ResolvedExercise {
	exerciseId: string
	/** The snapshot the entry keeps; null for cardio. */
	muscleGroup: MuscleGroup | null
}

/** The exercises of a live snapshot or a form, matched to the user's own rows only (IDOR). */
@Injectable()
export class LoggedExercisesService {
	constructor(
		private readonly workoutsService: WorkoutsService,
		private readonly programsService: ProgramsService,
	) {}

	/**
	 * Each input's dictionary row, in order: the user's own row by id, else by name (found or
	 * created; another user's id never matches). A template exercise must be of the session's
	 * template. An explicit «Власна вага» goes to the dictionary.
	 */
	async resolve(
		{
			userId,
			templateId,
			exercises,
		}: { userId: string; templateId: string | null; exercises: readonly ExerciseInput[] },
		tx: Prisma.TransactionClient,
	): Promise<ResolvedExercise[]> {
		await this.assertTemplateExercises({ userId, templateId, exercises }, tx)
		const rows = await this.workoutsService.findOrCreateExercises(
			userId,
			exercises.map(({ name, kind, exerciseId, muscleGroup }) => ({
				name,
				kind,
				exerciseId,
				// the chip's group fills a new or group-less row; none: the dictionary of names
				muscleGroup,
			})),
			tx,
		)
		const resolved: ResolvedExercise[] = []
		for (const [index, exercise] of exercises.entries()) {
			const row = rows[index]
			// findOrCreateExercises returns one row per item
			if (!row) throw new Error('Exercise row missing for a logged exercise')
			if (exercise.isBodyweight !== null && exercise.kind !== 'CARDIO') {
				await this.workoutsService.setExerciseBodyweight(
					userId,
					{ id: row.id, isBodyweight: exercise.isBodyweight },
					tx,
				)
			}
			resolved.push({
				exerciseId: row.id,
				muscleGroup:
					exercise.kind === 'CARDIO'
						? null
						: (row.muscleGroup ?? exercise.muscleGroup ?? matchMuscleGroup(exercise.name)),
			})
		}
		return resolved
	}

	private async assertTemplateExercises(
		{
			userId,
			templateId,
			exercises,
		}: { userId: string; templateId: string | null; exercises: readonly ExerciseInput[] },
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const named = exercises.flatMap(({ templateExerciseId }) => templateExerciseId ?? [])
		if (named.length === 0) return
		const own =
			templateId === null
				? new Set<string>()
				: await this.programsService.findTemplateExerciseIds(userId, templateId, tx)
		if (named.some((id) => !own.has(id))) throw new ProgramTemplateNotFoundException()
	}
}
