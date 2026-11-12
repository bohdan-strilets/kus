import { DEFAULT_STAGE_CAP_USD } from './budget-limits.js'
import type { EvalCase } from './cases/index.js'
import { isHiddenCaseId, PRIVATE_ID_PREFIX } from './cases/private-cases.js'

export const EVAL_KEY_ENV = 'OPENROUTER_EVAL_API_KEY'

export const EVAL_KEY_MISSING_MESSAGE = `${EVAL_KEY_ENV} не задано: eval ходить в OpenRouter лише окремим ключем з місячним лімітом (не виробничим OPENROUTER_API_KEY). Створи окремий ключ в OpenRouter, постав йому місячний ліміт і впиши в apps/api/.env.`

export const STAGE_REQUIRED_MESSAGE =
	'Платний прогін потребує --stage <етап>. Створи бюджет етапу один раз: --stage <етап> --stage-cap 0.3 (без прогону), потім запускай з --stage <етап>.'

export const SMOKE_EMPTY_MESSAGE =
	'--smoke: список SMOKE_CASE_IDS (src/cases/smoke.ts) порожній — спершу його має заповнити ai-eval-analyst.'

/** Paid requests use only the separate eval key — never the production OPENROUTER_API_KEY. */
export const requireEvalKey = (env: NodeJS.ProcessEnv): string => {
	const key = env[EVAL_KEY_ENV]
	if (!key) throw new Error(EVAL_KEY_MISSING_MESSAGE)
	return key
}

export const requireStage = (stage: string | undefined): string => {
	if (!stage) throw new Error(STAGE_REQUIRED_MESSAGE)
	return stage
}

const STAGE_CAP_FLAG = '--stage-cap'

/** `--stage-cap` with no value after it creates the ledger with the default per-release cap. */
export const withDefaultStageCap = (argv: readonly string[]): string[] =>
	argv.flatMap((arg, index) => {
		const next = argv[index + 1]
		const isValueMissing = next === undefined || next.startsWith('--')
		return arg === STAGE_CAP_FLAG && isValueMissing ? [arg, String(DEFAULT_STAGE_CAP_USD)] : [arg]
	})

export const parseIdList = (raw: string | undefined): string[] =>
	(raw ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean)

interface SelectOptions {
	only?: string
	isSmoke: boolean
	smokeIds: readonly string[]
}

/** `--only` ∪ `--smoke`, deduplicated; undefined = no selection (all cases of the set). */
export const getSelectedIds = ({ only, isSmoke, smokeIds }: SelectOptions): Set<string> | null => {
	if (!only && !isSmoke) return null
	if (isSmoke && smokeIds.length === 0) throw new Error(SMOKE_EMPTY_MESSAGE)
	return new Set([...parseIdList(only), ...(isSmoke ? smokeIds : [])])
}

/** Private ids are never printed (they may be real words) — only the counts. */
export const assertSmokeResolvable = (
	smokeIds: readonly string[],
	cases: readonly EvalCase[],
): void => {
	const known = new Set(cases.map((evalCase) => evalCase.id))
	const missing = smokeIds.filter((id) => !known.has(id))
	if (missing.length === 0) return
	const missingPrivate = missing.filter((id) => id.startsWith(PRIVATE_ID_PREFIX)).length
	const unknown = missing.filter((id) => !id.startsWith(PRIVATE_ID_PREFIX))
	const parts: string[] = []
	if (missingPrivate > 0) {
		parts.push(
			`не знайдено ${missingPrivate} приватних кейсів (немає data/private/*.cases.json або в ньому нема цих id)`,
		)
	}
	if (unknown.length > 0) {
		const shown = unknown.filter((id) => !isHiddenCaseId(id))
		parts.push(`невідомих id: ${unknown.length}${shown.length > 0 ? ` (${shown.join(', ')})` : ''}`)
	}
	throw new Error(`--smoke: ${parts.join('; ')}.`)
}
