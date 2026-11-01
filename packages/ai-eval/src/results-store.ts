import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { CaseResult } from './eval.types.js'

export const RESULTS_DIR = new URL('../results/', import.meta.url)

/** `2026-11-01T13:59:03.436Z` → `2026-11-01T13-59-03-436Z`: one stamp names the .jsonl and the .json of a run. */
export const toFileStamp = (iso: string): string => iso.replace(/[:.]/g, '-')

export interface ResultLine extends CaseResult {
	promptVersion: string
	reasoning: string
}

export interface ResultsWriter {
	file: URL
	/** Resolves once the line is on disk; lines of parallel cases never interleave. */
	append: (line: ResultLine) => Promise<void>
}

/** One JSON line per finished case, so an interrupted run keeps everything it has paid for. */
export const createResultsWriter = async (
	dir: URL,
	runStartIso: string,
): Promise<ResultsWriter> => {
	await mkdir(dir, { recursive: true })
	const file = new URL(`${toFileStamp(runStartIso)}.jsonl`, dir)
	await writeFile(file, '')
	let chain: Promise<void> = Promise.resolve()
	const append = (line: ResultLine): Promise<void> => {
		const text = `${JSON.stringify(line)}\n`
		const write = chain.then(() => appendFile(file, text))
		// a failed write must not poison later lines; the caller still sees this error
		chain = write.catch(() => undefined)
		return write
	}
	return { file, append }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const isCaseResult = (value: unknown): value is CaseResult =>
	isRecord(value) && typeof value.caseId === 'string' && typeof value.model === 'string'

const toCaseResults = (items: unknown[], source: string): CaseResult[] =>
	items.map((item) => {
		if (!isCaseResult(item)) throw new Error(`${source}: not a case result (no caseId / model)`)
		return item
	})

/** Reads a `.jsonl` (one result per line) or the `.json` summary (runs with `results`) into case results. */
export const loadResultsFile = async (path: string): Promise<CaseResult[]> => {
	const text = await readFile(path, 'utf8')
	if (path.endsWith('.jsonl')) {
		const lines = text.split('\n').filter((line) => line.trim() !== '')
		return toCaseResults(
			lines.map((line): unknown => JSON.parse(line)),
			path,
		)
	}
	const json: unknown = JSON.parse(text)
	if (!Array.isArray(json)) throw new Error(`${path}: expected a results array`)
	const items = json.flatMap((run: unknown) =>
		isRecord(run) && Array.isArray(run.results) ? (run.results as unknown[]) : [],
	)
	return toCaseResults(items, path)
}

export const getResultsPath = (file: URL): string => fileURLToPath(file)
