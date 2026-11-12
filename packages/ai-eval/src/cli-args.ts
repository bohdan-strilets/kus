import { parseArgs } from 'node:util'

import { AI_REASONING_MODES, type AiReasoningMode, FOOD_PARSE_REASONING } from '@kus/shared'

import type { EvalCase } from './cases/index.js'
import { PRIVATE_ID_PREFIX } from './cases/private-cases.js'
import { DEFAULT_MAX_COST_USD } from './budget-limits.js'
import { assertSmokeResolvable, getSelectedIds, withDefaultStageCap } from './cli-guards.js'
import { loadSmokeIds } from './smoke-ids.js'

const DEFAULT_CONCURRENCY = 4

export const { values: args } = parseArgs({
	args: withDefaultStageCap(process.argv.slice(2)),
	options: {
		models: { type: 'string' },
		estimate: { type: 'boolean', default: false },
		'max-cost': { type: 'string', default: String(DEFAULT_MAX_COST_USD) },
		concurrency: { type: 'string', default: String(DEFAULT_CONCURRENCY) },
		only: { type: 'string' },
		smoke: { type: 'boolean', default: false },
		set: { type: 'string', default: 'all' },
		reasoning: { type: 'string', default: FOOD_PARSE_REASONING },
		stage: { type: 'string' },
		'stage-cap': { type: 'string' },
		'raise-stage-cap': { type: 'string' },
		'allow-over-month': { type: 'boolean', default: false },
		'past-80': { type: 'boolean', default: false },
		rescore: { type: 'string' },
	},
})

const isReasoningMode = (value: string): value is AiReasoningMode =>
	Object.hasOwn(AI_REASONING_MODES, value)

export const getReasoning = (): AiReasoningMode => {
	if (!isReasoningMode(args.reasoning)) {
		throw new Error(`--reasoning must be one of: ${Object.keys(AI_REASONING_MODES).join(', ')}`)
	}
	return args.reasoning
}

export const getModels = (): string[] => {
	const list = args.models ?? process.env.AI_MODEL ?? ''
	const models = list
		.split(',')
		.map((model) => model.trim())
		.filter(Boolean)
	if (models.length === 0)
		throw new Error('No model: pass --models or set AI_MODEL in apps/api/.env')
	return models
}

const CASE_SETS = new Set(['all', 'repo', 'private', 'holdout'])
export const HOLDOUT_SET = 'holdout'

const isInSet = (evalCase: EvalCase): boolean => {
	if (args.set === HOLDOUT_SET) return true
	const isPrivate = evalCase.id.startsWith(PRIVATE_ID_PREFIX)
	if (args.set === 'private') return isPrivate
	if (args.set === 'repo') return !isPrivate
	return true
}

export const filterCases = async (cases: EvalCase[]): Promise<EvalCase[]> => {
	if (!CASE_SETS.has(args.set))
		throw new Error(`--set must be one of: ${[...CASE_SETS].join(', ')}`)
	const smokeIds = args.smoke ? await loadSmokeIds() : []
	const ids = getSelectedIds({ only: args.only, isSmoke: args.smoke, smokeIds })
	if (args.smoke) assertSmokeResolvable(smokeIds, cases)
	const inSet = cases.filter(isInSet)
	return ids ? inSet.filter((evalCase) => ids.has(evalCase.id)) : inSet
}
