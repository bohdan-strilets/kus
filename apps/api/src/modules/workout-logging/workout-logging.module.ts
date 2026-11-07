import { Module } from '@nestjs/common'

import { ChatModule } from '../chat/chat.module'
import { ProgramsModule } from '../programs/programs.module'
import { UsersModule } from '../users/users.module'
import { WorkoutsModule } from '../workouts/workouts.module'
import { LiveSnapshotWriterService } from './live-snapshot-writer.service'
import { LiveSnapshotService } from './live-snapshot.service'
import { LiveWorkoutsController } from './live-workouts.controller'
import { LiveWorkoutsService } from './live-workouts.service'
import { LoggedExercisesService } from './logged-exercises.service'
import { WorkoutFormsController } from './workout-forms.controller'
import { WorkoutFormsService } from './workout-forms.service'
import { WorkoutLoggingRepository } from './workout-logging.repository'

// the live mode and the form: a module of its own, because it needs the chat (the summary message)
// and programs (the plan), and neither the chat nor workouts may import them back; nothing imports it
@Module({
	imports: [ChatModule, ProgramsModule, UsersModule, WorkoutsModule],
	controllers: [LiveWorkoutsController, WorkoutFormsController],
	providers: [
		LiveSnapshotService,
		LiveSnapshotWriterService,
		LiveWorkoutsService,
		LoggedExercisesService,
		WorkoutFormsService,
		WorkoutLoggingRepository,
	],
})
export class WorkoutLoggingModule {}
