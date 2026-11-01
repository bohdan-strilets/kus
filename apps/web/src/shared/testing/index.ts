// tests only: never imported by app code
export {
	apiErrorBody,
	createFakeAdapter,
	type FakeAdapter,
	type FakeHandler,
	type FakeReply,
} from './create-fake-adapter'
export { stubMatchMedia } from './match-media'
export { createWrapper, renderHookWithProviders, renderWithProviders } from './render'
export { makeProgress } from './progress.fixture'
export { makeChatMessage, makeProgram } from './program.fixture'
export { makeExercise, makeWorkout } from './workout.fixture'
export { makeWeightedStats, makeBodyweightStats } from './exercise-stats.fixture'
export {
	BENCH_ID,
	BIKE_ID,
	makeWorkoutStats,
	PULLUP_ID,
	TREADMILL_ID,
} from './workout-stats.fixture'
