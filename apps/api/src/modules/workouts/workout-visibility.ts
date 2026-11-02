import type { Prisma } from '../../generated/prisma/client'

/**
 * NOT (source = 'LIVE' AND finished_at IS NULL): a live session still going on is a draft. The
 * journal, the day, the statistics, the history of an exercise, records and the program's turn see
 * it only once it is finished; the model's «Today's workouts» lists it (it appends to it).
 */
export const HIDE_OPEN_LIVE = {
	NOT: { source: 'LIVE', finishedAt: null },
} satisfies Prisma.WorkoutWhereInput
