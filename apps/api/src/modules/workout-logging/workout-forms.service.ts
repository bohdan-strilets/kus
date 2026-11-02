import { Injectable, Logger } from '@nestjs/common'
import type { FormExerciseInput, WorkoutFinished, WorkoutForm } from '@kus/shared'

import { toDbDate } from '../../common/time'
import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'
import { ChatWorkoutSummaryService } from '../chat/chat-workout-summary.service'
import { ProgramTemplateNotFoundException } from '../programs/programs.exceptions'
import { ProgramsService } from '../programs/programs.service'
import { UsersService } from '../users/users.service'
import { WorkoutKcalService } from '../workouts/workout-kcal.service'
import { WorkoutRecordsService } from '../workouts/workout-records.service'
import { WorkoutNotFoundException } from '../workouts/workouts.exceptions'
import { readWorkoutRecords } from '../workouts/workouts.mapper'
import type { WorkoutWithExercises } from '../workouts/workouts.repository'
import { findFormTimeIssue, getFormTime } from './form-time'
import { LoggedExercisesService, type ResolvedExercise } from './logged-exercises.service'
import { WorkoutLoggingFieldException } from './workout-logging.exceptions'
import { type LoggedExerciseWrite, WorkoutLoggingRepository } from './workout-logging.repository'

const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION

/** «не робили» never reaches the server; an exercise with nothing in it is the same. */
const isDone = (exercise: FormExerciseInput): boolean =>
	exercise.sets.length > 0 || exercise.durationMin !== null || exercise.distanceM !== null

const toFormWrite = (
	exercise: FormExerciseInput,
	{ exerciseId, muscleGroup }: ResolvedExercise,
	{ position, performedAt }: { position: number; performedAt: Date },
): LoggedExerciseWrite => ({
	exerciseId,
	name: exercise.name,
	kind: exercise.kind,
	muscleGroup,
	position,
	durationMin: exercise.durationMin,
	distanceM: exercise.distanceM,
	performedAt,
	clientKey: null,
	templateExerciseId: exercise.templateExerciseId,
	isBodyweight: exercise.isBodyweight,
	sets: exercise.sets.map((set, index) => ({ ...set, position: index, doneAt: null })),
})

/** A form answers 201 with a new session, 200 for a repeat of the same request. */
export interface SavedForm {
	response: WorkoutFinished
	isCreated: boolean
}

/** «Заповнити»: a session told after the fact, finished at once, with a Kusik summary in the chat. */
@Injectable()
export class WorkoutFormsService {
	private readonly logger = new Logger(WorkoutFormsService.name)

	constructor(
		private readonly prisma: PrismaService,
		private readonly repository: WorkoutLoggingRepository,
		private readonly loggedExercises: LoggedExercisesService,
		private readonly records: WorkoutRecordsService,
		private readonly summary: ChatWorkoutSummaryService,
		private readonly programsService: ProgramsService,
		private readonly usersService: UsersService,
		private readonly kcal: WorkoutKcalService,
	) {}

	/** Idempotent by `clientRequestId`: a repeat (or a parallel twin) returns the first session. */
	async save(userId: string, form: WorkoutForm): Promise<SavedForm> {
		const repeat = await this.findRepeat(userId, form.clientRequestId)
		if (repeat) return { response: repeat, isCreated: false }
		const now = new Date()
		const { timezone } = await this.usersService.getMe(userId)
		const time = getFormTime({ ...form, timezone })
		const issue = findFormTimeIssue({
			localDate: form.localDate,
			startedAt: time.startedAt,
			now,
			timezone,
		})
		if (issue) throw new WorkoutLoggingFieldException(issue.field, issue.code)
		const done = form.exercises.filter(isDone)
		if (done.length === 0) throw new WorkoutLoggingFieldException('exercises', 'TOO_SMALL')
		const { templateId } = form
		if (
			templateId !== null &&
			!(await this.programsService.hasActiveTemplate(userId, templateId))
		) {
			throw new ProgramTemplateNotFoundException()
		}
		try {
			const saved = await this.prisma.$transaction(async (tx) => {
				const resolved = await this.loggedExercises.resolve(
					{ userId, templateId, exercises: done },
					tx,
				)
				const workout = await this.repository.createFormWorkout(
					{
						userId,
						localDate: toDbDate(form.localDate),
						...time,
						durationMin: form.durationMin,
						templateId,
						exercises: done.flatMap((exercise, position) => {
							const row = resolved[position]
							const timing = { position, performedAt: time.startedAt }
							return row ? [toFormWrite(exercise, row, timing)] : []
						}),
					},
					tx,
				)
				const records = await this.records.computeRecords(userId, workout, tx)
				const posted = await this.summary.postSummary(
					{
						userId,
						finished: { workout, records },
						isAutoClosed: false,
						clientMessageId: form.clientRequestId,
					},
					tx,
				)
				return { ...posted, hasNewRecord: records.length > 0 }
			})
			this.logger.log(
				`Workout form saved user=${userId} workout=${saved.workout.id} exercises=${saved.workout.exercises.length}`,
			)
			return {
				response: {
					workout: await this.toWorkoutResponse(userId, saved.workout),
					messageId: saved.messageId,
					hasNewRecord: saved.hasNewRecord,
				},
				isCreated: true,
			}
		} catch (error) {
			// a parallel twin of the same request wrote its summary first
			if (!isUniqueViolation(error)) throw error
			const twin = await this.findRepeat(userId, form.clientRequestId)
			if (!twin) throw error
			return { response: twin, isCreated: false }
		}
	}

	/** The answer a request with this id already got; null when it is a first one. */
	private async findRepeat(
		userId: string,
		clientRequestId: string,
	): Promise<WorkoutFinished | null> {
		const messageId = await this.summary.findMessageIdByClientId(userId, clientRequestId)
		if (messageId === null) return null
		const workout = await this.repository.findByFinishedMessage({ userId, messageId })
		if (!workout) return null
		return {
			workout: await this.toWorkoutResponse(userId, workout),
			messageId,
			hasNewRecord: readWorkoutRecords(workout).length > 0,
		}
	}

	private async toWorkoutResponse(
		userId: string,
		workout: WorkoutWithExercises,
	): Promise<WorkoutFinished['workout']> {
		const [response] = await this.kcal.toResponses(userId, [workout])
		if (!response) throw new WorkoutNotFoundException()
		return response
	}
}
