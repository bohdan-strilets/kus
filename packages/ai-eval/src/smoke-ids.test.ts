import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { SMOKE_CASE_IDS } from './cases/smoke.js'
import { loadSmokeIds, PRIVATE_SMOKE_FILE } from './smoke-ids.js'

let dir = ''
const makeDir = async (): Promise<URL> => {
	dir = await mkdtemp(join(tmpdir(), 'smoke-'))
	return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = ''
})

describe('loadSmokeIds', () => {
	it('is the public list when the private file is missing', async () => {
		expect(await loadSmokeIds(await makeDir())).toEqual([...SMOKE_CASE_IDS])
	})

	it('adds the private ids, without duplicates', async () => {
		const target = await makeDir()
		const ids = ['private:a', 'private:b', SMOKE_CASE_IDS[0] ?? 'x']
		await writeFile(join(dir, PRIVATE_SMOKE_FILE), JSON.stringify({ ids }))

		const result = await loadSmokeIds(target)

		expect(result).toHaveLength(SMOKE_CASE_IDS.length + 2)
		expect(result).toContain('private:a')
	})

	it('rejects a file of the wrong shape', async () => {
		const target = await makeDir()
		await writeFile(join(dir, PRIVATE_SMOKE_FILE), JSON.stringify({ ids: 'private:a' }))

		await expect(loadSmokeIds(target)).rejects.toThrow(PRIVATE_SMOKE_FILE)
	})
})
