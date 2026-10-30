// What the model sees of a tool schema is trimmed to save prefix tokens. parseToolCalls still
// validates with the full zod schema, so nothing is lost.
import { z } from 'zod'

const DATE_FORMAT = 'date'
const NULL_TYPE = 'null'
/** Metadata key: the model sees a plain string; zod still checks (or falls back for) the enum. */
const OPEN_ENUM_KEY = 'x-open-enum'

type JsonSchema = Record<string, unknown>

export interface ModelParametersOptions {
	/**
	 * A bare schema keeps only types, enums and descriptions: no minimum, item counts or patterns
	 * either (the memory tools; their rules live in zod and the parser).
	 */
	isBare?: boolean
}

/**
 * Marks a field whose enum the model knows from elsewhere (save_food.category — «Same list as
 * log_food»): the list is dropped from what the model sees, the description stays.
 */
export const withOpenEnumForModel = <T extends z.ZodType>(schema: T, description: string): T =>
	schema.meta({ description, [OPEN_ENUM_KEY]: true })

/**
 * Per node of the generated schema:
 * - a date keeps only `format: date` (the ~240-char ISO regex repeated in every date field cost ~1k tokens);
 * - `default` goes (a defaulted field stays required in the output schema, the model always sends
 *   it, and zod fills a missing one);
 * - `additionalProperties: false` goes (a stray key is dropped by zod);
 * - string lengths and numeric bounds go (~1k characters of digits); a lower bound of 0 stays, since
 *   "not negative" / "positive" tells the model what the field is. A value out of bounds fails zod
 *   and gets a validation retry. Item counts (`minItems` / `maxItems`) stay: they are rules.
 */
const trimForModel = ({ jsonSchema }: { jsonSchema: JsonSchema }): void => {
	if (jsonSchema.format === DATE_FORMAT) delete jsonSchema.pattern
	delete jsonSchema.default
	delete jsonSchema.additionalProperties
	delete jsonSchema.minLength
	delete jsonSchema.maxLength
	delete jsonSchema.maximum
	delete jsonSchema.exclusiveMaximum
	if (jsonSchema.minimum !== 0) delete jsonSchema.minimum
	if (jsonSchema.exclusiveMinimum !== 0) delete jsonSchema.exclusiveMinimum
}

const trimBare = ({ jsonSchema }: { jsonSchema: JsonSchema }): void => {
	trimForModel({ jsonSchema })
	delete jsonSchema.minimum
	delete jsonSchema.exclusiveMinimum
	delete jsonSchema.minItems
	delete jsonSchema.maxItems
	delete jsonSchema.pattern
}

/** After compaction the enum of a marked field sits next to the mark: both go. */
const dropOpenEnums = (node: unknown): unknown => {
	if (Array.isArray(node)) return node.map(dropOpenEnums)
	if (typeof node !== 'object' || node === null) return node
	const { [OPEN_ENUM_KEY]: isOpen, ...rest } = node as JsonSchema
	const cleaned = Object.fromEntries(
		Object.entries(rest).map(([key, value]) => [key, dropOpenEnums(value)]),
	)
	if (isOpen !== true) return cleaned
	const { enum: _enum, ...withoutEnum } = cleaned
	return withoutEnum
}

const toJsonParameters = (schema: z.ZodType, { isBare = false }: ModelParametersOptions) => {
	const { $schema: _schema, ...parameters } = z.toJSONSchema(schema, {
		target: 'draft-07',
		override: isBare ? trimBare : trimForModel,
	})
	return parameters
}

const isNullBranch = (branch: unknown): boolean =>
	typeof branch === 'object' &&
	branch !== null &&
	(branch as JsonSchema).type === NULL_TYPE &&
	Object.keys(branch).length === 1

/**
 * `anyOf: [X, { type: 'null' }]` → X with `type: [X.type, 'null']`: the same schema in fewer
 * characters. An `enum` gets null in its list, since `enum` applies whatever the type says.
 */
const compactNullable = (node: unknown): unknown => {
	if (Array.isArray(node)) return node.map(compactNullable)
	if (typeof node !== 'object' || node === null) return node
	const compacted: JsonSchema = Object.fromEntries(
		Object.entries(node).map(([key, value]) => [key, compactNullable(value)]),
	)
	const { anyOf } = compacted
	if (!Array.isArray(anyOf) || anyOf.length !== 2) return compacted
	const nullIndex = anyOf.findIndex(isNullBranch)
	const other: unknown = nullIndex < 0 ? undefined : anyOf[1 - nullIndex]
	if (typeof other !== 'object' || other === null) return compacted
	const { type, enum: values } = other as { type?: unknown; enum?: unknown }
	if (typeof type !== 'string') return compacted
	const { anyOf: _anyOf, ...rest } = compacted
	return {
		...rest,
		...other,
		type: [type, NULL_TYPE],
		...(Array.isArray(values) ? { enum: [...(values as unknown[]), null] } : {}),
	}
}

/** The `parameters` of a tool as the model gets them. */
// output side: defaulted fields stay required (nullable), which models follow more reliably
export const toModelParameters = (
	schema: z.ZodType,
	options: ModelParametersOptions = {},
): JsonSchema => dropOpenEnums(compactNullable(toJsonParameters(schema, options))) as JsonSchema

/** The same schema without the nullable compaction: what the compacted one must stay equal to. */
export const toUncompactedParameters = (
	schema: z.ZodType,
	options: ModelParametersOptions = {},
): JsonSchema => dropOpenEnums(toJsonParameters(schema, options)) as JsonSchema
