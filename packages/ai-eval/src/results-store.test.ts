import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import type { CaseResult } from './eval.types.js'
import {
	createResultsWriter,
	loadResultsFile,
	type ResultLine,
	toFileStamp,
} from './results-store.js'

const line = (caseId: string): ResultLine =>
	({ caseId, model: 'm', promptVersion: 'p1', reasoning: 'low', costUsd: 0.01 }) as ResultLine

const START = '2026-11-01T10:00:00.000Z'

let dir = ''
const makeDir = async (): Promise<URL> => {
	dir = await mkdtemp(join(tmpdir(), 'results-'))
	return pathToFileURL(`${dir}/`)
}

afterEach(async () => {
	if (dir) await rm(dir, { recursive: true, force: true })
	dir = ''
})

describe('toFileStamp', () => {
	it('is the iso string without : and .', () => {
		expect(toFileStamp('2026-11-01T13:59:03.436Z')).toBe('2026-11-01T13-59-03-436Z')
	})
})

describe('createResultsWriter', () => {
	it('creates the file at the start, before any case', async () => {
		const writer = await createResultsWriter(await makeDir(), START)

		expect(fileURLToPath(writer.file)).toMatch(/2026-11-01T10-00-00-000Z\.jsonl$/)
		expect(await readFile(writer.file, 'utf8')).toBe('')
	})

	it('has each line on disk as soon as append resolves', async () => {
		const writer = await createResultsWriter(await makeDir(), START)

		await writer.append(line('a'))
		expect((await readFile(writer.file, 'utf8')).trim().split('\n')).toHaveLength(1)
		await writer.append(line('b'))

		const lines = (await readFile(writer.file, 'utf8')).trim().split('\n')
		expect(lines.map((text) => JSON.parse(text) as unknown)).toMatchObject([
			{ caseId: 'a', model: 'm', promptVersion: 'p1' },
			{ caseId: 'b' },
		])
	})

	it('keeps parallel appends as whole lines', async () => {
		const writer = await createResultsWriter(await makeDir(), START)

		await Promise.all(Array.from({ length: 25 }, (_, index) => writer.append(line(`c${index}`))))

		const lines = (await readFile(writer.file, 'utf8')).trim().split('\n')
		expect(lines).toHaveLength(25)
		expect(lines.every((text) => (JSON.parse(text) as CaseResult).model === 'm')).toBe(true)
	})
})

describe('loadResultsFile', () => {
	it('reads a .jsonl written by the writer', async () => {
		const writer = await createResultsWriter(await makeDir(), START)
		await writer.append(line('a'))
		await writer.append(line('b'))

		const results = await loadResultsFile(fileURLToPath(writer.file))

		expect(results.map((result) => result.caseId)).toEqual(['a', 'b'])
	})

	it('reads the .json summary (runs with results)', async () => {
		await makeDir()
		const file = join(dir, 'run.json')
		const runs = [
			{ model: 'm', results: [line('a')] },
			{ model: 'n', results: [line('b')] },
		]
		await writeFile(file, JSON.stringify(runs))

		const results = await loadResultsFile(file)

		expect(results.map((result) => result.caseId)).toEqual(['a', 'b'])
	})

	it('rejects a line that is not a case result', async () => {
		await makeDir()
		const file = join(dir, 'bad.jsonl')
		await writeFile(file, '{"nope":1}\n')

		await expect(loadResultsFile(file)).rejects.toThrow('not a case result')
	})
})
