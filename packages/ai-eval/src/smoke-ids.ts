import { readFile } from 'node:fs/promises'

import { z } from 'zod'

import { SMOKE_CASE_IDS } from './cases/smoke.js'
import { PRIVATE_CASES_DIR } from './cases/private-cases.js'

export const PRIVATE_SMOKE_FILE = 'smoke.private.json'

const privateSmokeSchema = z.object({ ids: z.array(z.string().min(1)) })

const isNotFound = (error: unknown): boolean =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT'

/**
 * Public ids from smoke.ts plus the optional gitignored data/private/smoke.private.json
 * (`{ "ids": ["private:…"] }`): private ids must not live in git. A missing file is the normal state.
 */
export const loadSmokeIds = async (dir: URL = PRIVATE_CASES_DIR): Promise<string[]> => {
	const text = await readFile(new URL(PRIVATE_SMOKE_FILE, dir), 'utf8').catch((error: unknown) => {
		if (isNotFound(error)) return null
		throw error
	})
	if (text === null) return [...SMOKE_CASE_IDS]
	const parsed = privateSmokeSchema.safeParse(JSON.parse(text))
	if (!parsed.success)
		throw new Error(`data/private/${PRIVATE_SMOKE_FILE}: ${z.prettifyError(parsed.error)}`)
	return [...new Set([...SMOKE_CASE_IDS, ...parsed.data.ids])]
}
