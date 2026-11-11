import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REBUILD_COMMAND = 'pnpm --filter @kus/shared build'
const PROMPT_FILE = join('ai', 'prompt')
const PROMPT_VERSION_PATTERN = /PROMPT_VERSION\s*=\s*['"]([^'"]+)['"]/
const SOURCE_FILE_PATTERN = /\.ts$/
const TEST_FILE_PATTERN = /\.test\.ts$/

export const SHARED_DIST_MISSING_MESSAGE = `Збірки @kus/shared немає (packages/shared/dist). eval імпортує її, а не src. Збери: ${REBUILD_COMMAND}`

export const sharedVersionMismatchMessage = (srcVersion: string, distVersion: string): string =>
	`Збірка @kus/shared застаріла: PROMPT_VERSION у src = ${srcVersion}, у dist = ${distVersion}. eval ганяв би старий промпт. Перебудуй: ${REBUILD_COMMAND}`

export const sharedSourceNewerMessage = (file: string): string =>
	`Збірка @kus/shared застаріла: ${file} змінено пізніше за dist/index.js (зміна без bump PROMPT_VERSION теж потрапляє в промпт чи схеми). Перебудуй: ${REBUILD_COMMAND}`

export interface SourceFileStamp {
	file: string
	mtimeMs: number
}

export interface SharedGuardIo {
	/** null = the file does not exist */
	readText: (path: string) => Promise<string | null>
	/** null = the file does not exist */
	getMtimeMs: (path: string) => Promise<number | null>
	listSourceFiles: (dir: string) => Promise<SourceFileStamp[]>
}

export interface SharedGuardOptions {
	srcDir: string
	distDir: string
	io: SharedGuardIo
}

const readVersion = (code: string | null): string | null =>
	code === null ? null : (PROMPT_VERSION_PATTERN.exec(code)?.[1] ?? null)

/**
 * Stops the eval when packages/shared/dist lags behind packages/shared/src.
 * The version is parsed from the text of prompt.ts / prompt.js (an import would return dist itself).
 * The mtime check can fire without a real change (git checkout/pull touches src): the rebuild is cheap.
 */
export const assertSharedBuildFresh = async ({
	srcDir,
	distDir,
	io,
}: SharedGuardOptions): Promise<void> => {
	const distIndexMtime = await io.getMtimeMs(join(distDir, 'index.js'))
	const distVersion = readVersion(await io.readText(join(distDir, `${PROMPT_FILE}.js`)))
	if (distIndexMtime === null || distVersion === null) throw new Error(SHARED_DIST_MISSING_MESSAGE)

	const srcVersion = readVersion(await io.readText(join(srcDir, `${PROMPT_FILE}.ts`)))
	if (srcVersion !== null && srcVersion !== distVersion)
		throw new Error(sharedVersionMismatchMessage(srcVersion, distVersion))

	const newer = (await io.listSourceFiles(srcDir)).find((entry) => entry.mtimeMs > distIndexMtime)
	if (newer) throw new Error(sharedSourceNewerMessage(newer.file))
}

const isMissing = (error: unknown): boolean =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'

const listFilesRecursive = async (dir: string): Promise<SourceFileStamp[]> => {
	const entries = await readdir(dir, { withFileTypes: true })
	const nested = await Promise.all(
		entries.map(async (entry): Promise<SourceFileStamp[]> => {
			const path = join(dir, entry.name)
			if (entry.isDirectory()) return listFilesRecursive(path)
			if (!SOURCE_FILE_PATTERN.test(entry.name) || TEST_FILE_PATTERN.test(entry.name)) return []
			return [{ file: path, mtimeMs: (await stat(path)).mtimeMs }]
		}),
	)
	return nested.flat()
}

export const nodeSharedGuardIo: SharedGuardIo = {
	readText: async (path) => {
		try {
			return await readFile(path, 'utf8')
		} catch (error: unknown) {
			if (isMissing(error)) return null
			throw error
		}
	},
	getMtimeMs: async (path) => {
		try {
			return (await stat(path)).mtimeMs
		} catch (error: unknown) {
			if (isMissing(error)) return null
			throw error
		}
	},
	listSourceFiles: listFilesRecursive,
}

export const assertSharedBuildFreshOnDisk = (): Promise<void> =>
	assertSharedBuildFresh({
		srcDir: fileURLToPath(new URL('../../shared/src', import.meta.url)),
		distDir: fileURLToPath(new URL('../../shared/dist', import.meta.url)),
		io: nodeSharedGuardIo,
	})
