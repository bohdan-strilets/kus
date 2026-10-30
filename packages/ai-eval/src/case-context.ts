import type { FactContext, FoodParseContext } from '@kus/shared'

/**
 * The context a case may set. Facts may be written as plain texts: they get the refs `f1…` in
 * order, like the backend numbers them.
 */
export type CaseContext = Omit<Partial<FoodParseContext>, 'facts'> & {
	facts?: string[] | FactContext[]
}

const FACT_REF_PREFIX = 'f'

const toFactContexts = (facts: string[] | FactContext[]): FactContext[] =>
	facts.map((fact, index) =>
		typeof fact === 'string' ? { ref: `${FACT_REF_PREFIX}${index + 1}`, text: fact } : fact,
	)

export const toFoodContext = ({ facts, ...rest }: CaseContext = {}): Partial<FoodParseContext> => ({
	...rest,
	...(facts ? { facts: toFactContexts(facts) } : {}),
})
