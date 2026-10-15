const KEY_PATTERN = /<Key>([\s\S]*?)<\/Key>/g
const TRUNCATED_PATTERN = /<IsTruncated>\s*true\s*<\/IsTruncated>/
const NEXT_TOKEN_PATTERN = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/
const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
}
const HEX_RADIX = 16

export interface ListObjectsPage {
	keys: string[]
	nextToken: string | null
}

/** One pass, so `&amp;lt;` becomes `&lt;` and not `<`. */
const unescapeXml = (value: string): string =>
	value.replace(ENTITY_PATTERN, (_match, entity: string) => {
		const named = NAMED_ENTITIES[entity]
		if (named !== undefined) return named
		const isHex = entity.startsWith('#x')
		const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? HEX_RADIX : 10)
		return String.fromCodePoint(codePoint)
	})

/** Reads a ListObjectsV2 response without an XML library; the shape is fixed and flat. */
export const parseListObjectsPage = (xml: string): ListObjectsPage => {
	const keys = [...xml.matchAll(KEY_PATTERN)].map((match) => unescapeXml(match[1] ?? ''))
	if (!TRUNCATED_PATTERN.test(xml)) return { keys, nextToken: null }
	const token = NEXT_TOKEN_PATTERN.exec(xml)?.[1]
	// a truncated page without a token would loop forever
	if (!token) throw new Error('Truncated listing has no continuation token')
	return { keys, nextToken: unescapeXml(token) }
}
