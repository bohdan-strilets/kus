import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	isFoodMentioned,
	MEMORY_MAX_FOODS,
	type MemoryFoodContext,
	normalizeName,
} from '@kus/shared'
import { z } from 'zod'

import { type EvalCase, evalCaseSchema, type SavedFood, savedFoodSchema } from './case.types.js'

/** Real meals of the owner — gitignored, picked up only when present (CLAUDE.md §9: no personal data in git). */
export const PRIVATE_CASES_DIR = new URL('../../data/private/', import.meta.url)
export const PRIVATE_ID_PREFIX = 'private:'
const CASES_SUFFIX = '.cases.json'
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

/** The saved foods a message mentions, with `m1…` refs — the same selection the backend makes. */
const toMemoryContext = (foods: SavedFood[], text: string): MemoryFoodContext[] =>
	foods
		.filter((food) =>
			isFoodMentioned(
				{ nameNormalized: normalizeName(food.name), aliases: food.aliases.map(normalizeName) },
				text,
			),
		)
		.slice(0, MEMORY_MAX_FOODS)
		.map((food, index) => ({
			ref: `m${index + 1}`,
			name: food.name,
			aliases: food.aliases,
			per100g: food.per100g,
			pieceGrams: food.pieceGrams,
			defaultGrams: food.defaultGrams,
			category: food.category,
		}))

export const loadPrivateCases = async (): Promise<EvalCase[]> => {
	const [cases, foods] = await Promise.all([
		readJsonFiles(CASES_SUFFIX, z.array(evalCaseSchema)),
		readJsonFiles(FOODS_SUFFIX, z.array(savedFoodSchema)),
	])
	return cases.map((item) => ({
		...item,
		id: `${PRIVATE_ID_PREFIX}${item.id}`,
		context: { memory: toMemoryContext(foods, item.text) },
	}))
}
