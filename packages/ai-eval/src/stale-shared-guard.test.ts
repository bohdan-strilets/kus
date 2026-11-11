import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	assertSharedBuildFresh,
	SHARED_DIST_MISSING_MESSAGE,
	sharedSourceNewerMessage,
	sharedVersionMismatchMessage,
	type SharedGuardIo,
	type SourceFileStamp,
} from './stale-shared-guard.js'

const SRC = 'shared/src'
const DIST = 'shared/dist'

interface Fixture {
	files?: Record<string, string>
	distIndexMtime?: number | null
	sources?: SourceFileStamp[]
}

const run = (fixture: Fixture): Promise<void> => {
	const files: Record<string, string> = fixture.files ?? {
		[join(SRC, 'ai', 'prompt.ts')]: "export const PROMPT_VERSION = '2026-11-10.9'",
		[join(DIST, 'ai', 'prompt.js')]: "export const PROMPT_VERSION = '2026-11-10.9';",
	}
	const io: SharedGuardIo = {
		readText: (path) => Promise.resolve(files[path] ?? null),
		getMtimeMs: () =>
			Promise.resolve(fixture.distIndexMtime === undefined ? 1000 : fixture.distIndexMtime),
		listSourceFiles: () => Promise.resolve(fixture.sources ?? [{ file: 'a.ts', mtimeMs: 500 }]),
	}
	return assertSharedBuildFresh({ srcDir: SRC, distDir: DIST, io })
}

describe('assertSharedBuildFresh', () => {
	it('passes when versions match and dist is newer than src', async () => {
		await expect(run({})).resolves.toBeUndefined()
	})

	it('stops when the PROMPT_VERSION differs', async () => {
		await expect(
			run({
				files: {
					[join(SRC, 'ai', 'prompt.ts')]: "export const PROMPT_VERSION = '2026-11-10.9'",
					[join(DIST, 'ai', 'prompt.js')]: 'export const PROMPT_VERSION = "2026-11-10.8";',
				},
			}),
		).rejects.toThrow(sharedVersionMismatchMessage('2026-11-10.9', '2026-11-10.8'))
	})

	it('names the rebuild command in the message', () => {
		expect(sharedVersionMismatchMessage('a', 'b')).toContain('pnpm --filter @kus/shared build')
	})

	it('stops when a source file is newer than dist/index.js', async () => {
		await expect(run({ sources: [{ file: 'tools.ts', mtimeMs: 2000 }] })).rejects.toThrow(
			sharedSourceNewerMessage('tools.ts'),
		)
	})

	it('stops with a clear error when dist is missing', async () => {
		await expect(run({ files: {}, distIndexMtime: null })).rejects.toThrow(
			SHARED_DIST_MISSING_MESSAGE,
		)
	})

	it('stops when dist has no readable PROMPT_VERSION', async () => {
		await expect(run({ files: { [join(DIST, 'ai', 'prompt.js')]: 'export {}' } })).rejects.toThrow(
			SHARED_DIST_MISSING_MESSAGE,
		)
	})
})
