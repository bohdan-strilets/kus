import type { PrismaService } from '../src/prisma'

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
/** Also keeps the name safe to interpolate into CREATE DATABASE. */
const TEST_DB_NAME_PATTERN = /^[a-z0-9_]+_test$/

interface SafeTestDatabase {
	url: URL
	dbName: string
}

/** Tests wipe every table: refuse anything but a local database named `*_test`. */
export const assertSafeTestDatabase = (databaseUrl: string): SafeTestDatabase => {
	const url = new URL(databaseUrl)
	const dbName = url.pathname.slice(1)
	// a libpq "host" query param overrides the URL host, so it counts as remote
	const isLocal = LOCAL_DB_HOSTS.has(url.hostname) && !url.searchParams.has('host')
	if (!isLocal || !TEST_DB_NAME_PATTERN.test(dbName)) {
		throw new Error(
			`Refusing to run DB tests against "${url.hostname}/${dbName}": need local *_test`,
		)
	}
	return { url, dbName }
}

/** Empties all domain tables between tests; migrations history stays. */
export const resetDatabase = async (prisma: PrismaService): Promise<void> => {
	const [current] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`
	if (!current || !TEST_DB_NAME_PATTERN.test(current.name)) {
		throw new Error(`Refusing to truncate non-test database "${current?.name ?? 'unknown'}"`)
	}

	const tables = await prisma.$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
	if (tables.length === 0) return
	// identifiers come from the catalog, not user input; TRUNCATE can't take them as bind parameters
	const tableList = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ')
	await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
}
