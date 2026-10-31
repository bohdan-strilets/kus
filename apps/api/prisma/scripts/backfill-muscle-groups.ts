// Muscle groups for exercises logged before 0.10.0 (docs: plan-0.10.0, «Бекфіл груп»).
//   $env:DB_URL = Read-Host 'DB_URL'
//   pnpm --filter @kus/api db:backfill-muscle-groups --dry-run   # SELECT only: counts and unknown names
//   pnpm --filter @kus/api db:backfill-muscle-groups --apply     # one transaction, idempotent
//   Remove-Item Env:DB_URL
// The URL comes only from the shell's DB_URL, never from .env or DATABASE_URL: the script is run
// against a chosen database (a dump copy, production) on purpose, never by accident.
import { Logger } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'

import { type Prisma, PrismaClient } from '../../src/generated/prisma/client'
import { MuscleGroup } from '../../src/generated/prisma/enums'
import { groupIdsByMuscleGroup, planMuscleGroupBackfill } from './muscle-group-backfill'

const DRY_RUN_FLAG = '--dry-run'
const APPLY_FLAG = '--apply'
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:'])
// up to two UPDATEs per group over a remote connection; the default 5 s is too tight
const APPLY_TRANSACTION_TIMEOUT_MS = 60_000

type Mode = 'dry-run' | 'apply'

const logger = new Logger('BackfillMuscleGroups')

const readMode = (args: readonly string[]): Mode => {
	const flags = args.filter((arg) => arg !== '--')
	if (flags.length === 1 && flags[0] === DRY_RUN_FLAG) return 'dry-run'
	if (flags.length === 1 && flags[0] === APPLY_FLAG) return 'apply'
	throw new Error(`Pass exactly one of ${DRY_RUN_FLAG} or ${APPLY_FLAG}`)
}

const readConnectionString = (): string => {
	const connectionString = process.env.DB_URL
	if (!connectionString) throw new Error('DB_URL is not set in this shell')
	if (!POSTGRES_PROTOCOLS.has(new URL(connectionString).protocol)) {
		throw new Error('DB_URL is not a postgres:// URL')
	}
	return connectionString
}

// An admin script over every user's dictionary: no userId filter on purpose, and it prints only
// counts and exercise names — no ids, users, weights or dates.
const findStrengthExercises = (prisma: Prisma.TransactionClient) =>
	prisma.exercise.findMany({
		where: { deletedAt: null, kind: { in: ['STRENGTH', 'OTHER'] } },
		select: { id: true, name: true, muscleGroup: true },
	})

const dryRun = async (prisma: PrismaClient): Promise<void> => {
	const plan = planMuscleGroupBackfill(await findStrengthExercises(prisma))
	logger.log(
		`with group: ${plan.withGroup}; from dictionary: ${plan.fromDictionary.length}; without group: ${plan.unmatchedNames.length} name(s)`,
	)
	for (const name of plan.unmatchedNames) logger.log(`without group: ${name}`)
}

const apply = async (prisma: PrismaClient): Promise<void> => {
	const { exercises, entries } = await prisma.$transaction(
		async (tx) => {
			const plan = planMuscleGroupBackfill(await findStrengthExercises(tx))
			let exerciseCount = 0
			for (const [muscleGroup, ids] of groupIdsByMuscleGroup(plan.fromDictionary)) {
				const { count } = await tx.exercise.updateMany({
					where: { id: { in: ids }, muscleGroup: null },
					data: { muscleGroup },
				})
				exerciseCount += count
			}
			// the snapshot of every non-cardio entry, live or not, from its dictionary row
			let entryCount = 0
			for (const muscleGroup of Object.values(MuscleGroup)) {
				const { count } = await tx.exerciseEntry.updateMany({
					where: { muscleGroup: null, kind: { not: 'CARDIO' }, exercise: { muscleGroup } },
					data: { muscleGroup },
				})
				entryCount += count
			}
			return { exercises: exerciseCount, entries: entryCount }
		},
		{ timeout: APPLY_TRANSACTION_TIMEOUT_MS },
	)
	logger.log(`exercises updated: ${exercises}; exercise entries updated: ${entries}`)
	await dryRun(prisma)
}

const main = async (): Promise<void> => {
	const mode = readMode(process.argv.slice(2))
	const prisma = new PrismaClient({
		adapter: new PrismaPg({ connectionString: readConnectionString() }),
	})
	try {
		if (mode === 'dry-run') await dryRun(prisma)
		else await apply(prisma)
	} finally {
		await prisma.$disconnect()
	}
}

main().catch((error: unknown) => {
	// only the message: a connection error may carry the URL in its details
	logger.error(error instanceof Error ? error.message : 'Backfill failed')
	process.exitCode = 1
})
