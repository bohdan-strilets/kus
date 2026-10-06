import { execSync } from 'node:child_process'

import { PrismaPg } from '@prisma/adapter-pg'
import type { TestProject } from 'vitest/node'

import { PrismaClient } from '../src/generated/prisma/client'
import { assertSafeTestDatabase } from './test-database'

const MAINTENANCE_DB = 'postgres'

const ensureDatabaseExists = async (url: URL, dbName: string): Promise<void> => {
	const maintenanceUrl = new URL(url)
	maintenanceUrl.pathname = `/${MAINTENANCE_DB}`
	const admin = new PrismaClient({
		adapter: new PrismaPg({ connectionString: maintenanceUrl.toString() }),
	})
	try {
		const rows = await admin.$queryRaw<{ exists: boolean }[]>`
			SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"`
		// CREATE DATABASE can't take a bind parameter; the name passed assertSafeTestDatabase's pattern
		if (!rows[0]?.exists) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`)
	} catch (error) {
		throw new Error(
			`Test database at ${url.host} is unreachable. Start local PostgreSQL with \`pnpm db:up\`.`,
			{ cause: error },
		)
	} finally {
		await admin.$disconnect()
	}
}

/** Creates the test DB if needed and applies migrations, once per `vitest run`. */
export default async (project: TestProject): Promise<void> => {
	const databaseUrl = project.config.env.DATABASE_URL
	if (!databaseUrl) throw new Error('DATABASE_URL is not set in vitest config `test.env`')

	const { url, dbName } = assertSafeTestDatabase(databaseUrl)
	await ensureDatabaseExists(url, dbName)

	execSync('pnpm exec prisma migrate deploy', {
		// vitest root is apps/api, where prisma.config.ts lives
		cwd: project.config.root,
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: 'pipe',
	})
}
