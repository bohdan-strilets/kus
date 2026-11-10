import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { type EvalCase, evalCaseSchema, savedFoodSchema } from './case.types.js'
import { CONTEXT_PRESETS } from './context-presets.js'
import { loadEvalPhoto } from './photo.js'

/** Real meals of the owner — gitignored, picked up only when present (CLAUDE.md §9: no personal data in git). */
export const PRIVATE_CASES_DIR = new URL('../../data/private/', import.meta.url)
export const PRIVATE_ID_PREFIX = 'private:'
/** Written by the author and never tuned for: only `--set holdout` runs them, `all` doesn't. */
export const HOLDOUT_ID_PREFIX = 'holdout:'
/** Private and hold-out cases may be real words: the terminal shows their counts, not their content. */
export const isHiddenCaseId = (id: string): boolean =>
	id.startsWith(PRIVATE_ID_PREFIX) || id.startsWith(HOLDOUT_ID_PREFIX)

const CASES_SUFFIX = '.cases.json'
const HOLDOUT_SUFFIX = '.holdout.json'
const FOODS_SUFFIX = '.foods.json'

const readJsonFiles = async <T>(suffix: string, schema: z.ZodType<T[]>): Promise<T[]> => {
	const dir = fileURLToPath(PRIVATE_CASES_DIR)
	const files = await readdir(dir).catch((error: unknown) => {
		// no private folder is the normal state in a fresh clone
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
		throw error
	})
	const items: T[] = []
	for (const file of files.filter((name) => name.endsWith(suffix)).sort()) {
		const json: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'))
		const parsed = schema.safeParse(json)
		if (!parsed.success) throw new Error(`data/private/${file}: ${z.prettifyError(parsed.error)}`)
		items.push(...parsed.data)
	}
	return items
}

const warn = (message: string): void => {
	process.stderr.write(`⚠ data/private/${message}
`)
}

const loadJsonCases = async (suffix: string, idPrefix: string): Promise<EvalCase[]> => {
	const [cases, foods] = await Promise.all([
		readJsonFiles(suffix, z.array(evalCaseSchema)),
		readJsonFiles(FOODS_SUFFIX, z.array(savedFoodSchema)),
	])
	const dir = fileURLToPath(PRIVATE_CASES_DIR)
	return Promise.all(
		cases.map(async (item) => ({
			...item,
			id: `${idPrefix}${item.id}`,
			context: {
				...(item.addressForm === undefined ? {} : { addressForm: item.addressForm }),
				...(item.contextPreset === undefined ? {} : CONTEXT_PRESETS[item.contextPreset]),
			},
			// the «Saved foods» block is picked from these by the case's words (buildCaseContext), find_food searches them all
			savedFoods: foods,
			// the bytes live in memory for the run only; results/ keeps ids and numbers, never the photo
			photo: item.image === undefined ? undefined : await loadEvalPhoto(dir, item.image, warn),
		})),
	)
}

export const loadPrivateCases = (): Promise<EvalCase[]> =>
	loadJsonCases(CASES_SUFFIX, PRIVATE_ID_PREFIX)

export const loadHoldoutCases = (): Promise<EvalCase[]> =>
	loadJsonCases(HOLDOUT_SUFFIX, HOLDOUT_ID_PREFIX)
